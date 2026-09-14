const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const connectionManager = require('../db/connectionManager');
const { hashPassword, verifyPassword } = require('../utils/password');
const { normalizeEmail } = require('../utils/normalize');
const { validateStrongPassword } = require('../utils/passwordPolicy');
const { sendTransactionalEmail } = require('../services/transactionalEmailService');

const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
let passwordResetTableChecked = false;

const hashResetCode = (email, code) => crypto
  .createHash('sha256')
  .update(`${String(email || '').toLowerCase()}::${String(code || '')}`)
  .digest('hex');

const generateResetCode = () => String(Math.floor(100000 + Math.random() * 900000));

const mapTenantSession = (tenant) => {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    status: tenant.status,
    sector: tenant.sector || 'Indústria',
    cnpj: tenant.cnpj || '',
    phone: tenant.phone || '',
    purchaseVolume: tenant.purchaseVolume ?? tenant.purchase_volume ?? '',
    customDomain: tenant.customDomain ?? tenant.custom_domain ?? '',
    brandColor: tenant.brandColor ?? tenant.brand_color ?? '#1A202C',
    logoUrl: tenant.logoUrl ?? tenant.logo_url ?? '',
  };
};

const getOriginBaseUrl = (req) => {
  const origin = String(req.headers.origin || '').trim();
  if (origin) return origin.replace(/\/+$/, '');
  const host = String(req.headers.host || '').trim();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  if (host) return `${protocol}://${host}`;
  return 'https://comparaia.com.br';
};

const ensurePasswordResetStorage = async (db) => {
  if (passwordResetTableChecked) return;

  let hasTable = await db.schema.hasTable('password_reset_codes');
  if (!hasTable) {
    try {
      await db.schema.createTable('password_reset_codes', (table) => {
        table.uuid('id').primary();
        table.string('email', 255).notNullable();
        table.string('code_hash', 128).notNullable();
        table.integer('attempts').notNullable().defaultTo(0);
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at').nullable();
        table.timestamps(true, true);
      });
      hasTable = true;
    } catch (err) {
      // Production environments can run with restricted DB grants.
      // If migration already created the table, continue; otherwise, fail loudly.
      hasTable = await db.schema.hasTable('password_reset_codes');
      if (!hasTable) {
        throw err;
      }
      console.warn('[Auth] password_reset_codes runtime create skipped:', err?.message || err);
    }
  }

  // Best-effort indexes (migrations should be the source of truth in production).
  try {
    await db.raw('CREATE INDEX IF NOT EXISTS password_reset_codes_email_idx ON password_reset_codes (lower(email))');
    await db.raw('CREATE INDEX IF NOT EXISTS password_reset_codes_expires_idx ON password_reset_codes (expires_at)');
  } catch (err) {
    console.warn('[Auth] password_reset_codes runtime index create skipped:', err?.message || err);
  }

  passwordResetTableChecked = true;
};

const login = async (req, res) => {
  try {
    console.info('[Auth] login hit', { path: req.path, isMasterContext: req.isMasterContext, tenantMissing: req.tenantMissing });
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: 'Email invalido.' });
    const db = req.db;

    // Master context: platform admin login
    if (req.isMasterContext) {
      const masterUser = await db('users').whereRaw('lower(email) = ?', [normalizedEmail]).first();

      // 1. If not found in Master Users, completely invalid
      if (!masterUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      // 2. Platform Admin Login (Standard)
      if (masterUser.role === 'PLATFORM_ADMIN') {
        const masterCheck = await verifyPassword(password, masterUser.password);
        const validMaster = masterCheck.valid;
        if (masterCheck.needsUpgrade) {
          const newHash = await hashPassword(password);
          await db('users').where({ id: masterUser.id }).update({ password: newHash, updated_at: new Date() });
          console.info(`[Auth] Upgraded password hash (${masterCheck.scheme} -> bcrypt) for: ${masterUser.email}`);
        }
        if (!validMaster) return res.status(401).json({ error: 'Credenciais inválidas.' });
        if (masterUser.status !== 'ACTIVE') return res.status(403).json({ error: 'Usuário inativo.' });

        const token = jwt.sign(
          { userId: masterUser.id, email: masterUser.email, role: masterUser.role, tenantId: 'MASTER' },
          config.security.jwtSecret,
          { expiresIn: config.security.jwtExpiresIn },
        );

        const response = {
          token,
          user: { ...masterUser, tenantId: 'MASTER' }, // Simplificado
          tenant: {
            id: 'MASTER',
            name: 'Plataforma Compara IA',
            slug: 'MASTER',
            plan: 'PLATFORM_ADMIN',
            status: 'ACTIVE',
            sector: 'Tecnologia',
          },
        };
        console.info('[Auth] master login success', { user: masterUser.email });
        return res.json(response);
      }

      // 3. Global Login (User is not Admin, so must belong to a Tenant)
      // Try to find which tenant they belong to
      console.info('[Auth] Global Login attempt for:', normalizedEmail);

      // DEBUG: Log found user status
      if (!masterUser) {
        console.warn('[Auth] User not found in master DB for:', normalizedEmail);
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      } else {
        console.info('[Auth] User found:', masterUser.id, 'Role:', masterUser.role);
      }

      const globalCheck = await verifyPassword(password, masterUser.password);
      const validPass = globalCheck.valid;
      if (globalCheck.needsUpgrade) {
        const newHash = await hashPassword(password);
        await db('users').where({ id: masterUser.id }).update({ password: newHash, updated_at: new Date() });
        console.info(`[Auth] Upgraded password hash (${globalCheck.scheme} -> bcrypt) for: ${masterUser.email}`);
      }
      if (!validPass) {
        console.error(`[DEBUG] Password Validation FAILED for: ${normalizedEmail}`);
        console.error(`[DEBUG] Input Password Details: Length=${password ? password.length : 'NULL'}, Start=${password ? password.substring(0, 1) + '***' : 'NULL'}`);
        console.error(`[DEBUG] Stored Hash Details: Length=${masterUser.password ? masterUser.password.length : 'NULL'}, Start=${masterUser.password ? masterUser.password.substring(0, 4) : 'NULL'}`);
        console.warn('[Auth] Password mismatch for:', normalizedEmail);
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      } else {
        console.info(`[DEBUG] Password Validation SUCCESS for: ${normalizedEmail}`);
      }

      // Find linkage
      const linkage = await db('user_tenants')
        .join('tenants', 'user_tenants.tenant_id', 'tenants.id')
        .select([
          'user_tenants.role as tenantRole',
          'tenants.id as tenantId',
          'tenants.name',
          'tenants.slug',
          'tenants.plan',
          'tenants.status',
          'tenants.sector',
          'tenants.cnpj',
          'tenants.phone',
          'tenants.purchase_volume as purchaseVolume',
          'tenants.custom_domain as customDomain',
          'tenants.brand_color as brandColor',
          'tenants.logo_url as logoUrl',
        ])
        .where('user_tenants.user_id', masterUser.id)
        .first();

      if (!linkage) {
        console.warn('[Auth] No tenant linkage found for:', normalizedEmail);
        return res.status(403).json({ error: 'Usuário sem organização vinculada. Contate suporte.' });
      }

      // Log them in AS IF they were in the tenant context
      const token = jwt.sign(
        { userId: masterUser.id, email: masterUser.email, role: linkage.tenantRole || 'MEMBER', tenantId: linkage.tenantId },
        config.security.jwtSecret,
        { expiresIn: config.security.jwtExpiresIn },
      );

      const response = {
        token,
        user: {
          id: masterUser.id,
          name: masterUser.name,
          email: masterUser.email,
          role: linkage.tenantRole || 'MEMBER',
          tenantId: linkage.tenantId,
          status: masterUser.status,
        },
        tenant: mapTenantSession({
          id: linkage.tenantId,
          name: linkage.name,
          slug: linkage.slug,
          plan: linkage.plan,
          status: linkage.status,
          sector: linkage.sector,
          cnpj: linkage.cnpj,
          phone: linkage.phone,
          purchaseVolume: linkage.purchaseVolume,
          customDomain: linkage.customDomain,
          brandColor: linkage.brandColor,
          logoUrl: linkage.logoUrl,
        }),
      };

      console.info(`[Auth] Global Login Redirect -> ${linkage.slug}`);
      return res.json(response);
    }

    // Global tenant login - scan all active tenant schemas to find user by email
    let user = null;
    let targetTenant = req.tenant;

    if (req.tenantMissing || !req.tenant) {
      const allTenants = await db('tenants').where({ status: 'ACTIVE' });
      for (const t of allTenants) {
        try {
          const u = await db.withSchema(t.db_name)
            .from('users')
            .whereRaw('lower(email) = ?', [normalizedEmail])
            .first();
          if (u) { user = u; targetTenant = t; break; }
        } catch (_e) { /* schema may not exist yet */ }
      }
      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas ou usuário não encontrado.' });
      }
    } else {
      user = await db('users').whereRaw('lower(email) = ?', [normalizedEmail]).first();
      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }
    }

    const tenantCheck = await verifyPassword(password, user.password);
    const valid = tenantCheck.valid;
    if (tenantCheck.needsUpgrade) {
      const newHash = await hashPassword(password);
      const schemaName = targetTenant ? targetTenant.db_name : 'public';
      await db.withSchema(schemaName).from('users').where({ id: user.id }).update({ password: newHash, updated_at: new Date() });
      console.info(`[Auth] Upgraded password hash for: ${user.email}`);
    }
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Usuário inativo.' });
    }

    const tenantId = targetTenant ? targetTenant.id : 'MASTER';
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tenantId },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtExpiresIn },
    );

    const response = {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId,
        status: user.status,
      },
      tenant: targetTenant
        ? mapTenantSession(targetTenant)
        : {
          id: 'MASTER',
          name: 'Plataforma Compara IA',
          slug: 'MASTER',
          plan: 'PLATFORM_ADMIN',
          status: 'ACTIVE',
          sector: 'Tecnologia',
        },
    };
    console.info('[Auth] tenant login success', { email: normalizedEmail });
    return res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno no login.' });
  }
};


const impersonate = async (req, res) => {
  try {
    const { tenantId, userId } = req.body;
    const db = req.db;

    // Security Check: Only MASTER context admins can impersonate (enforced by route guard, but double check)
    if (!req.isMasterContext) {
      return res.status(403).json({ error: 'Impersonation requires master context.' });
    }

    // 1. Find Target Tenant
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    // 2. Find Target User in Tenant Schema
    let user;
    try {
      user = await db.withSchema(tenant.db_name).from('users').where({ id: userId }).first();
    } catch (e) {
      return res.status(404).json({ error: 'Tenant schema not found.' });
    }

    if (!user) return res.status(404).json({ error: 'User not found in tenant.' });

    // 3. Generate Token (Payload identical to normal login)
    // Impersonation token might have a flag `impersonator: req.user.id` if we want to track it
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        isImpersonation: true,
        impersonatorId: req.user.id // Original Admin ID
      },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtExpiresIn }
    );

    // 4. Return Login-like Response
    const response = {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        status: user.status,
      },
      tenant: mapTenantSession(tenant),
    };

    console.info(`[Auth] Impersonation: Admin ${req.user.email} -> ${user.email} (${tenant.slug})`);
    res.json(response);

  } catch (error) {
    console.error('Impersonate Error:', error);
    res.status(500).json({ error: 'Impersonation failed.' });
  }
};

const me = async (_req, res) => {
  res.json({ status: 'ok' });
};

const requestPasswordReset = async (req, res) => {
  const successResponse = {
    success: true,
    message: 'Se o e-mail estiver cadastrado, enviaremos um codigo de recuperacao.',
  };
  try {
    const db = connectionManager.getMaster();
    await ensurePasswordResetStorage(db);
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email invalido.' });
    }

    const user = await db('users')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .first();

    if (!user) {
      return res.json(successResponse);
    }

    const code = generateResetCode();
    const codeHash = hashResetCode(normalizedEmail, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

    await db('password_reset_codes')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .andWhereNull('used_at')
      .update({ used_at: now, updated_at: now });

    await db('password_reset_codes').insert({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      code_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    });

    const baseUrl = getOriginBaseUrl(req);
    const resetLink = `${baseUrl}/recover-password?email=${encodeURIComponent(normalizedEmail)}&code=${encodeURIComponent(code)}`;
    const emailResult = await sendTransactionalEmail({
      templateKey: 'password_reset',
      to: normalizedEmail,
      db,
      variables: {
        userName: user.name || 'Usuario',
        appName: 'Compara IA',
        resetCode: code,
        expiresMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
        resetLink,
      },
    });

    if (!emailResult?.sent) {
      console.warn('[Auth] Password reset email failed', { email: normalizedEmail, reason: emailResult?.reason });
      return res.status(500).json({
        error: 'Falha ao enviar email de recuperacao. Verifique a configuracao SMTP.',
        code: 'password_reset_email_failed',
        details: String(emailResult?.reason || 'send_failed'),
      });
    }

    return res.json(successResponse);
  } catch (error) {
    console.error('Request password reset error:', error);
    return res.status(500).json({ error: 'Erro ao solicitar recuperacao de senha.' });
  }
};

const verifyPasswordResetCode = async (req, res) => {
  try {
    const db = connectionManager.getMaster();
    await ensurePasswordResetStorage(db);
    const normalizedEmail = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!normalizedEmail || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Dados invalidos.' });
    }

    const now = new Date();
    const pending = await db('password_reset_codes')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .whereNull('used_at')
      .andWhere('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .first();

    if (!pending) {
      return res.status(400).json({ error: 'Codigo invalido ou expirado.' });
    }

    const expectedHash = hashResetCode(normalizedEmail, code);
    if (pending.code_hash !== expectedHash) {
      const attempts = Number(pending.attempts || 0) + 1;
      const updates = { attempts, updated_at: now };
      if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) updates.used_at = now;
      await db('password_reset_codes').where({ id: pending.id }).update(updates);
      return res.status(400).json({ error: 'Codigo invalido ou expirado.' });
    }

    return res.json({ success: true, message: 'Codigo validado com sucesso.' });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return res.status(500).json({ error: 'Erro ao validar codigo.' });
  }
};

const confirmPasswordReset = async (req, res) => {
  const trx = await connectionManager.getMaster().transaction();
  try {
    await ensurePasswordResetStorage(trx);
    const normalizedEmail = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!normalizedEmail || !/^\d{6}$/.test(code)) {
      await trx.rollback();
      return res.status(400).json({ error: 'Dados invalidos.' });
    }

    if (!newPassword) {
      await trx.rollback();
      return res.status(400).json({ error: 'Nova senha obrigatoria.' });
    }

    if (newPassword !== confirmPassword) {
      await trx.rollback();
      return res.status(400).json({ error: 'As senhas informadas nao coincidem.' });
    }
    const strongPassword = validateStrongPassword(newPassword);
    if (!strongPassword.valid) {
      await trx.rollback();
      return res.status(400).json({ error: strongPassword.message });
    }

    const now = new Date();
    const pending = await trx('password_reset_codes')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .whereNull('used_at')
      .andWhere('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .first();

    if (!pending) {
      await trx.rollback();
      return res.status(400).json({ error: 'Codigo invalido ou expirado.' });
    }

    const expectedHash = hashResetCode(normalizedEmail, code);
    if (pending.code_hash !== expectedHash) {
      const attempts = Number(pending.attempts || 0) + 1;
      const updates = { attempts, updated_at: now };
      if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) updates.used_at = now;
      await trx('password_reset_codes').where({ id: pending.id }).update(updates);
      await trx.rollback();
      return res.status(400).json({ error: 'Codigo invalido ou expirado.' });
    }

    const newHash = await hashPassword(newPassword);
    const masterUsers = await trx('users')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .select('id');

    if (!masterUsers || masterUsers.length === 0) {
      await trx.rollback();
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    await trx('users')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .update({ password: newHash, updated_at: now });

    const userIds = masterUsers.map((u) => u.id);
    const links = await trx('user_tenants')
      .join('tenants', 'user_tenants.tenant_id', 'tenants.id')
      .whereIn('user_tenants.user_id', userIds)
      .select('tenants.db_name');

    const schemas = Array.from(new Set((links || []).map((l) => l.db_name).filter(Boolean)));
    for (const schemaName of schemas) {
      try {
        await trx.withSchema(schemaName)
          .from('users')
          .whereRaw('lower(email) = ?', [normalizedEmail])
          .update({ password: newHash, updated_at: now });
      } catch (schemaErr) {
        console.warn('[Auth] Tenant schema password update skipped:', schemaName, schemaErr?.message);
      }
    }

    await trx('password_reset_codes')
      .where({ id: pending.id })
      .update({ used_at: now, updated_at: now });

    await trx.commit();
    return res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    try { await trx.rollback(); } catch {}
    console.error('Confirm password reset error:', error);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
};

module.exports = {
  login,
  me,
  impersonate,
  requestPasswordReset,
  verifyPasswordResetCode,
  confirmPasswordReset,
};
