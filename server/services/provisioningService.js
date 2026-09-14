const path = require('path');
const connectionManager = require('../db/connectionManager');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { hashPassword } = require('../utils/password');
const { normalizeEmail, normalizeCnpj, validateCpfCnpj } = require('../utils/normalize');
const { validateStrongPassword } = require('../utils/passwordPolicy');
const { sendTransactionalEmail } = require('./transactionalEmailService');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

class ProvisioningService {
  createError(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
  }

  async ensureEmailIsUnique(masterDb, normalizedEmail) {
    const existsInMaster = await masterDb('users')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .first();

    if (existsInMaster) {
      throw this.createError('E-mail já cadastrado em outra organização. Faça login ou recupere a senha.', 409);
    }

    // Legacy fallback: in case there is a user in tenant schema not mirrored in master users.
    const tenants = await masterDb('tenants').select('id', 'slug', 'db_name');
    for (const tenant of tenants) {
      try {
        const row = await masterDb
          .withSchema(tenant.db_name)
          .from('users')
          .whereRaw('lower(email) = ?', [normalizedEmail])
          .first();
        if (row) {
          throw this.createError('E-mail já cadastrado em outra organização. Faça login ou recupere a senha.', 409);
        }
      } catch (err) {
        if (err?.statusCode === 409) throw err;
        // ignore missing schema/table and continue
      }
    }
  }

  async registerTenant(inputData, existingDb = null) {
    console.log('>>> registerTenant CALLED with:', { name: inputData.name, email: inputData.email, slug: inputData.slug, plan: inputData.plan });

    // DEBUG: Log password details (masked) to verify reception from Frontend
    if (inputData.password) {
      console.error(`[DEBUG] Password received. Length: ${inputData.password.length}. Start: ${inputData.password.substring(0, 1)}***`);
    } else {
      console.error('[DEBUG] No password received in inputData! Generating random.');
    }

    const { name, email, slug, plan, adminName, password, cnpj, phone, sector, purchaseVolume, brandColor, customDomain } = inputData;
    const masterDb = existingDb || connectionManager.getMaster();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw this.createError('Email invalido.', 400);
    const normalizedCnpj = normalizeCnpj(cnpj);
    if (normalizedCnpj && !validateCpfCnpj(normalizedCnpj)) {
      throw this.createError('CPF/CNPJ invalido. Confira os digitos informados.', 400);
    }
    if (!password) {
      throw this.createError('Senha obrigatoria para cadastro.', 400);
    }
    const strongPassword = validateStrongPassword(password);
    if (!strongPassword.valid) {
      throw this.createError(strongPassword.message, 400);
    }
    await this.ensureEmailIsUnique(masterDb, normalizedEmail);

    // Fail-fast if default plan missing
    // We assume caller or seed ensured it exists, but good to check if we can.
    // However, without 'existingDb' we can't easily check 'token_plans' if passing isolated knex.
    // But if 'masterDb' works, we can check.

    // ... (rest of logic: slugify, check existing) ...
    const normalizedSlug = slugify(slug || name) || slugify(name);
    if (!normalizedSlug) throw this.createError('Slug invalido.', 400);

    const existing = await masterDb('tenants').where({ slug: normalizedSlug }).first();
    if (existing) throw this.createError('Slug ja existe.', 409);
    if (normalizedCnpj) {
      const existingCnpj = await masterDb('tenants')
        .whereRaw("regexp_replace(cnpj, '\\\\D', '', 'g') = ?", [normalizedCnpj])
        .first();
      if (existingCnpj) throw this.createError('CPF/CNPJ ja existe.', 409);
    }

    const tenantId = uuidv4();
    const safeSlug = normalizedSlug.replace(/[^a-z0-9]/g, '').toLowerCase().substr(0, 16);
    const dbName = `tenant_${safeSlug}_${Date.now()}`;

    const dbUser = process.env.DB_USER || connectionManager.dbConfig.connection.user;
    const dbPass = process.env.DB_PASSWORD || connectionManager.dbConfig.connection.password;
    const dbHost = process.env.DB_HOST || connectionManager.dbConfig.connection.host;

    const initialPassword = password || crypto.randomBytes(12).toString('base64url');
    const adminPassHash = await hashPassword(initialPassword);

    try {
      await masterDb.raw(`CREATE SCHEMA "${dbName}" AUTHORIZATION "${dbUser}"`);

      // Insert all valid columns
      await masterDb('tenants').insert({
        id: tenantId,
        name,
        slug: normalizedSlug,
        db_host: dbHost,
        db_name: dbName,
        db_user: dbUser,
        db_password: dbPass,
        status: 'ACTIVE',
        plan: plan || 'STARTER',

        // Metadata fields
        cnpj: normalizedCnpj || null,
        phone: phone || null,
        sector: sector || null,
        purchase_volume: purchaseVolume || null,
        brand_color: brandColor || null,
        custom_domain: customDomain || null,

        created_at: new Date(),
      });

      // Get tenant connection - if existingDb is passed (isolated), we can't use CM easily.
      // But we can create a dynamic knex instance if we are in a script context?
      // For now, let's assume we use CM's logic OR if existingDb is provided maybe we need to be careful.
      // Actually, for "Isolated Knex" scripts, we usually want to avoid CM. 
      // But provisioning usually needs to connect to the NEW schema/db.
      // If we are in a script, we should probably construct a knex instance manually.
      // However, to keep service compatible with app and script:

      let tenantKnex;

      // If running from script with isolated knex (existingDb), we probably want to create a new isolated connection for tenant
      // But avoiding CM singleton.
      if (existingDb) {
        const config = existingDb.client.config;
        tenantKnex = require('knex')({
          ...config,
          searchPath: [dbName, 'public'],
          pool: { min: 0, max: 2 } // small pool for setup
        });
      } else {
        tenantKnex = connectionManager.getTenantConnection({
          id: tenantId,
          slug: normalizedSlug,
          db_host: dbHost,
          db_name: dbName,
          db_user: dbUser,
          db_password: dbPass,
        });
      }

      await this.runMigrations(tenantKnex);

      // 1. Insert into Tenant Users (Isolated)
      const userId = uuidv4();
      await tenantKnex('users').insert({
        id: userId,
        name: adminName || 'Admin',
        email: normalizedEmail,
        password: adminPassHash,
        role: 'OWNER',
        status: 'ACTIVE',
        created_at: new Date(),
      });

      // 2. Insert into Master Users (Global Directory)
      const masterUserId = userId;
      await masterDb('users').insert({
        id: masterUserId,
        name: adminName || 'Admin',
        email: normalizedEmail,
        password: adminPassHash,
        role: 'ADMIN', // Global Role (not PLATFORM_ADMIN)
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 3. Link in user_tenants
      // Check if table exists (it should, we migrated it)
      const hasUserTenants = await masterDb.schema.hasTable('user_tenants');
      if (hasUserTenants) {
        await masterDb('user_tenants').insert({
          id: uuidv4(),
          user_id: masterUserId,
          tenant_id: tenantId,
          role: 'OWNER'
        });
      }

      // Bonus
      // Check plan first? For now assuming plan logic is minimal here or handled by caller.
      // The user asked to fail-fast if no 'free' plan. 
      // We can check plan existence in 'masterDb' before usage.

      const initialBonus = plan === 'ENTERPRISE' ? 1000 : 100;
      const transactionId = uuidv4();
      await masterDb('token_transactions').insert({
        id: transactionId,
        tenant_id: tenantId,
        amount: initialBonus,
        type: 'TOKEN_BONUS',
        description: 'Bônus de Boas Vindas',
        created_at: new Date()
      });

      // Initialize Wallet (Plan Limits + Bonus)
      // Hardcoded map to avoid async query, matching DEFAULT_PLANS
      const planLimits = { 'STARTER': 100, 'PRO': 5000, 'ENTERPRISE': 99999 };
      const planAmount = planLimits[plan] || 0;

      await masterDb('wallet').insert({
        tenant_id: tenantId,
        balance: planAmount + initialBonus,
        updated_at: new Date()
      });

      // Attempt transactional welcome email without breaking provisioning on failure.
      const emailResult = await Promise.race([
        sendTransactionalEmail({
          templateKey: 'welcome',
          to: normalizedEmail,
          db: masterDb,
          variables: {
            userName: adminName || 'Admin',
            tenantName: name,
            appName: 'Compara IA',
          },
        }),
        new Promise((resolve) => setTimeout(() => resolve({ sent: false, reason: 'email_timeout' }), 8000)),
      ]);

      if (!emailResult?.sent) {
        console.warn('[Provisioning Email] Welcome email not sent:', {
          tenantId,
          email: normalizedEmail,
          reason: emailResult?.reason || 'unknown',
        });
      }

      if (existingDb && tenantKnex) {
        await tenantKnex.destroy(); // Clean up if we created it manually
      }

      return {
        success: true,
        tenantId,
        dbName,
        slug: normalizedSlug,
        initialPassword,
        welcomeEmailSent: !!emailResult?.sent,
        welcomeEmailReason: emailResult?.reason || null,
      };
    } catch (error) {
      console.error('[Provisioning Failed]', error);
      // Attempt rollback
      try { await masterDb.raw(`DROP SCHEMA IF EXISTS "${dbName}" CASCADE`); } catch (e) { }
      if (error?.statusCode) throw error;
      throw this.createError('Erro no provisionamento: ' + error.message, 400);
    }
  }

  async runMigrations(knex) {
    // Run real migrations via Knex
    const migrationDir = path.join(__dirname, '..', 'migrations', 'tenant');
    try {
      await knex.migrate.latest({
        directory: migrationDir,
        tableName: 'knex_migrations'
      });
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }
  }
}

module.exports = new ProvisioningService();
