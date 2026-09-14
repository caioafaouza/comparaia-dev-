const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');
const { logAudit } = require('../services/auditService');
const { sendTransactionalEmail } = require('../services/transactionalEmailService');
const { hashPassword } = require('../utils/password');
const { normalizeEmail, normalizeCnpj, validateCpfCnpj } = require('../utils/normalize');

const mapTenant = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    createdAt: row.created_at,
    cnpj: row.cnpj,
    phone: row.phone,
    sector: row.sector,
    purchaseVolume: row.purchase_volume,
    customDomain: row.custom_domain,
    brandColor: row.brand_color,
    logoUrl: row.logo_url,
  };
};

const getTenantDetails = async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: 'Tenant not found' });

    const masterDb = connectionManager.getMaster();
    const tenantRow = await masterDb('tenants').where({ id: req.tenant.id }).first();
    if (!tenantRow) return res.status(404).json({ error: 'Tenant not found' });

    const usersCount = await req.db('users').count('id as count').first();
    const jobsCount = await req.db('comparison_jobs').count('id as count').first();
    const wallet = await billingService.getTenantWalletBalance(tenantRow);

    return res.json({
      tenant: mapTenant(tenantRow),
      usersCount: parseInt(usersCount?.count || 0, 10),
      totalJobs: parseInt(jobsCount?.count || 0, 10),
      walletBalance: wallet.balance,
    });
  } catch (error) {
    console.error('Tenant details error:', error);
    return res.status(500).json({ error: 'Erro ao carregar tenant.' });
  }
};

const updateTenantSelf = async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: 'Tenant not found' });
    const payload = req.body || {};

    const updates = {};
    if (payload.name != null) {
      const normalizedName = String(payload.name).trim();
      if (!normalizedName) return res.status(400).json({ error: 'Nome da empresa e obrigatorio.' });
      updates.name = normalizedName;
    }
    if (payload.cnpj != null) {
      updates.cnpj = normalizeCnpj(payload.cnpj);
      if (updates.cnpj && !validateCpfCnpj(updates.cnpj)) {
        return res.status(400).json({ error: 'CPF/CNPJ invalido. Confira os digitos informados.' });
      }
    }
    if (payload.phone != null) updates.phone = payload.phone;
    if (payload.sector != null) updates.sector = payload.sector;
    if (payload.purchaseVolume != null) updates.purchase_volume = payload.purchaseVolume;
    if (payload.customDomain != null) updates.custom_domain = payload.customDomain;
    if (payload.brandColor != null) updates.brand_color = payload.brandColor;
    if (payload.logoUrl != null) updates.logo_url = payload.logoUrl;
    if (payload.plan != null) {
      const normalizedPlan = String(payload.plan).trim().toUpperCase();
      if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(normalizedPlan)) {
        return res.status(400).json({ error: 'Plano invalido.' });
      }
      updates.plan = normalizedPlan;
    }

    const masterDb = connectionManager.getMaster();

    if (updates.cnpj) {
      const conflict = await masterDb('tenants')
        .whereRaw("regexp_replace(cnpj, '\\\\D', '', 'g') = ?", [updates.cnpj])
        .whereNot({ id: req.tenant.id })
        .first();
      if (conflict) return res.status(409).json({ error: 'CPF/CNPJ ja cadastrado.' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    updates.updated_at = new Date();
    await masterDb('tenants').where({ id: req.tenant.id }).update(updates);

    await logAudit(req, 'TENANT_UPDATE', 'tenant', JSON.stringify(updates));

    const tenantRow = await masterDb('tenants').where({ id: req.tenant.id }).first();
    return res.json({ tenant: mapTenant(tenantRow) });
  } catch (error) {
    console.error('Update tenant error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar tenant.' });
  }
};

const listUsers = async (req, res) => {
  try {
    const users = await req.db('users')
      .select('id', 'name', 'email', 'role', 'status')
      .orderBy('created_at', 'desc');

    const result = users.map((u) => ({
      id: u.id,
      tenantId: req.tenant?.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
    }));
    return res.json(result);
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, role, status, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (email && !normalizedEmail) return res.status(400).json({ error: 'Email invalido.' });
    if (!name || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios.' });

    const existing = await req.db('users').whereRaw('lower(email) = ?', [normalizedEmail]).first();
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado.' });

    const rawPass = password || crypto.randomBytes(10).toString('base64url');
    const hash = await hashPassword(rawPass);

    const userId = uuidv4();
    await req.db('users').insert({
      id: userId,
      name,
      email: normalizedEmail,
      password: hash,
      role: role || 'MEMBER',
      status: status || 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await logAudit(req, 'USER_CREATE', 'users', `email=${normalizedEmail}`);

    return res.status(201).json({
      id: userId,
      tenantId: req.tenant?.id,
      name,
      email: normalizedEmail,
      role: role || 'MEMBER',
      status: status || 'ACTIVE',
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

const inviteUser = async (req, res) => {
  try {
    const { name, email, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (email && !normalizedEmail) return res.status(400).json({ error: 'Email invalido.' });
    if (!name || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios.' });

    const existing = await req.db('users').whereRaw('lower(email) = ?', [normalizedEmail]).first();
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado.' });

    const rawPass = crypto.randomBytes(10).toString('base64url');
    const hash = await hashPassword(rawPass);
    const userId = uuidv4();

    await req.db('users').insert({
      id: userId,
      name,
      email: normalizedEmail,
      password: hash,
      role: role || 'MEMBER',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await logAudit(req, 'USER_INVITE', 'users', `email=${normalizedEmail}`);

    const frontend = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${String(frontend).replace(/\/+$/, '')}/login`;
    await sendTransactionalEmail({
      templateKey: 'user_invite',
      to: normalizedEmail,
      variables: {
        userName: name,
        tenantName: req.tenant?.name || 'Sua organizacao',
        inviteUrl,
        invitedBy: req.user?.email || '',
      },
    });

    return res.status(201).json({
      id: userId,
      tenantId: req.tenant?.id,
      name,
      email: normalizedEmail,
      role: role || 'MEMBER',
      status: 'ACTIVE',
      tempPassword: rawPass,
    });
  } catch (error) {
    console.error('Invite user error:', error);
    return res.status(500).json({ error: 'Erro ao convidar usuário.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const existing = await req.db('users').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const updates = {};
    if (payload.name != null) updates.name = payload.name;
    if (payload.email != null) {
      const normalizedEmail = normalizeEmail(payload.email);
      if (!normalizedEmail) return res.status(400).json({ error: 'Email invalido.' });
      const conflict = await req.db('users')
        .whereRaw('lower(email) = ?', [normalizedEmail])
        .whereNot({ id })
        .first();
      if (conflict) return res.status(409).json({ error: 'E-mail ja cadastrado.' });
      updates.email = normalizedEmail;
    }
    if (payload.role != null) updates.role = payload.role;
    if (payload.status != null) updates.status = payload.status;
    if (payload.password) updates.password = await hashPassword(payload.password);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    updates.updated_at = new Date();
    await req.db('users').where({ id }).update(updates);

    await logAudit(req, 'USER_UPDATE', 'users', `id=${id}`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const masterDb = connectionManager.getMaster();

    let deletedTenant = 0;
    try {
      deletedTenant = await req.db('users').where({ id }).delete();
    } catch (err) {
      console.warn(`[Tenant] Failed to delete user ${id} in tenant schema:`, err.message);
    }

    let masterUserExists = false;

    await masterDb.transaction(async (trx) => {
      const masterUser = await trx('users').where({ id }).first();
      masterUserExists = !!masterUser;

      const hasUserTenants = await trx.schema.hasTable('user_tenants');
      const hasLegacyTenantId = await trx.schema.hasColumn('users', 'tenant_id');

      if (tenantId && hasUserTenants) {
        await trx('user_tenants').where({ user_id: id, tenant_id: tenantId }).delete();
      }

      let shouldDeleteMaster = false;
      if (hasUserTenants) {
        const remainingLinks = await trx('user_tenants')
          .where({ user_id: id })
          .count('id as count')
          .first();
        if (!remainingLinks || parseInt(remainingLinks.count) === 0) {
          shouldDeleteMaster = true;
        }
      } else if (hasLegacyTenantId && tenantId) {
        const legacy = await trx('users').where({ id, tenant_id: tenantId }).first();
        if (legacy) shouldDeleteMaster = true;
      }

      if (shouldDeleteMaster) {
        await trx('users').where({ id }).delete();
      }
    });

    if (!deletedTenant && !masterUserExists) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await logAudit(req, 'USER_DELETE', 'users', `id=${id}`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const hasTable = await req.db.schema.hasTable('audit_logs');
    if (!hasTable) return res.json([]);

    const rows = await req.db('audit_logs').select('*').orderBy('created_at', 'desc').limit(200);
    const logs = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      timestamp: row.created_at,
      details: row.details || '',
    }));
    return res.json(logs);
  } catch (error) {
    console.error('Audit logs error:', error);
    return res.status(500).json({ error: 'Erro ao listar auditoria.' });
  }
};

const getTenantApiKeys = async (req, res) => {
  try {
    const masterDb = connectionManager.getMaster();
    const rows = await masterDb('tenant_api_keys')
      .where({ tenant_id: req.tenant.id })
      .orderBy('created_at', 'desc');
    const keys = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      createdAt: row.created_at,
      status: row.status,
    }));
    return res.json(keys);
  } catch (error) {
    console.error('Tenant api keys error:', error);
    return res.status(500).json({ error: 'Erro ao listar chaves.' });
  }
};

const createTenantApiKey = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });

    const rawKey = `ck_live_${crypto.randomBytes(16).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const masterDb = connectionManager.getMaster();
    await masterDb('tenant_api_keys').insert({
      id: uuidv4(),
      tenant_id: req.tenant.id,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      status: 'ACTIVE',
      created_at: new Date(),
    });

    await logAudit(req, 'API_KEY_CREATE', 'tenant_api_keys', `name=${name}`);
    return res.json({ rawKey });
  } catch (error) {
    console.error('Create tenant api key error:', error);
    return res.status(500).json({ error: 'Erro ao criar chave.' });
  }
};

const revokeTenantApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const masterDb = connectionManager.getMaster();
    const updated = await masterDb('tenant_api_keys')
      .where({ id, tenant_id: req.tenant.id })
      .update({ status: 'REVOKED', revoked_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'Chave não encontrada.' });

    await logAudit(req, 'API_KEY_REVOKE', 'tenant_api_keys', `id=${id}`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Revoke tenant api key error:', error);
    return res.status(500).json({ error: 'Erro ao revogar chave.' });
  }
};

const deleteTenantSelf = async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: 'Tenant not found' });
    const tenantId = req.tenant.id;
    const dbName = req.tenant.dbName || req.tenant.db_name;

    const masterDb = connectionManager.getMaster();

    await masterDb.transaction(async (trx) => {
      const hasUserTenants = await trx.schema.hasTable('user_tenants');
      const hasLegacyTenantId = await trx.schema.hasColumn('users', 'tenant_id');

      const tenantUsers = hasUserTenants
        ? await trx('user_tenants').where({ tenant_id: tenantId }).select('user_id')
        : [];

      // 1. Delete Dependencies
      if (hasUserTenants) {
        await trx('user_tenants').where({ tenant_id: tenantId }).delete();
      }

      if (await trx.schema.hasTable('token_transactions')) {
        await trx('token_transactions').where({ tenant_id: tenantId }).delete();
      }

      if (await trx.schema.hasTable('wallet')) {
        await trx('wallet').where({ tenant_id: tenantId }).delete();
      }

      if (await trx.schema.hasTable('tenant_api_keys')) {
        await trx('tenant_api_keys').where({ tenant_id: tenantId }).delete();
      }

      // 2. Drop Tenant Schema
      if (dbName) {
        try {
          await trx.raw(`DROP SCHEMA IF EXISTS "${dbName}" CASCADE`);
        } catch (err) {
          console.error(`Error dropping schema ${dbName}:`, err.message);
        }
      }

      // 3. Delete Tenant
      await trx('tenants').where({ id: tenantId }).delete();

      // 4. Cleanup Orphans
      if (hasUserTenants) {
        for (const u of tenantUsers) {
          const remainingLinks = await trx('user_tenants')
            .where({ user_id: u.user_id })
            .count('id as count')
            .first();
          if (!remainingLinks || parseInt(remainingLinks.count) === 0) {
            await trx('users').where({ id: u.user_id }).delete();
          }
        }
      }

      // 5. Legacy cleanup
      if (hasLegacyTenantId) {
        if (hasUserTenants) {
          await trx('users')
            .where({ tenant_id: tenantId })
            .whereNotExists(
              trx('user_tenants')
                .select(trx.raw('1'))
                .whereRaw('user_tenants.user_id = users.id')
            )
            .delete();
        } else {
          await trx('users').where({ tenant_id: tenantId }).delete();
        }
      }
    });

    // 4. Audit
    // We log to the master audit log if possible, or just console since tenant log is gone
    console.log(`[AUDIT] Tenant ${tenantId} deleted their own account.`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete tenant self error:', error);
    return res.status(500).json({ error: 'Erro ao cancelar conta.' });
  }
};

module.exports = {
  getTenantDetails,
  updateTenantSelf,
  deleteTenantSelf,
  listUsers,
  createUser,
  inviteUser,
  updateUser,
  deleteUser,
  getAuditLogs,
  getTenantApiKeys,
  createTenantApiKey,
  revokeTenantApiKey,
};


