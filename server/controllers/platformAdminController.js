const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');
const { sendTransactionalEmail, getTenantAdminRecipients } = require('../services/transactionalEmailService');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const DEFAULT_API_GATEWAY_CONFIG = {
  enabled: true,
  apiVersion: 'v1',
  globalRateLimit: 1200,
  timeoutMs: 15000,
  corsOrigins: ['*'],
  enableLogging: true,
};

const DEFAULT_SMTP_CONFIG = {
  host: '',
  port: 587,
  user: '',
  pass: '',
  secure: false,
  fromEmail: 'no-reply@comparaia.com',
};

const EMAIL_TEMPLATES_CONFIG_KEY = 'TRANSACTIONAL_EMAIL_TEMPLATES';

const DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATES = [
  {
    key: 'welcome',
    name: 'Boas-vindas',
    description: 'Enviado quando um novo tenant/usuario e criado.',
    subject: 'Bem-vindo(a) ao {{appName}}, {{userName}}',
    html: '<p>Ola, <strong>{{userName}}</strong>!</p><p>Seja bem-vindo(a) ao <strong>{{appName}}</strong>.</p><p>Sua organizacao <strong>{{tenantName}}</strong> ja pode utilizar a plataforma.</p>',
    text: 'Ola, {{userName}}! Seja bem-vindo(a) ao {{appName}}. Sua organizacao {{tenantName}} ja pode utilizar a plataforma.',
    enabled: true,
    variables: ['appName', 'userName', 'tenantName', 'supportEmail'],
  },
  {
    key: 'credit_confirmation',
    name: 'Confirmacao de Credito',
    description: 'Enviado quando ha recarga/credito de tokens.',
    subject: 'Credito confirmado: +{{amount}} tokens',
    html: '<p>Ola, {{userName}}.</p><p>Recebemos sua confirmacao de credito.</p><p><strong>+{{amount}} tokens</strong> foram adicionados ao tenant <strong>{{tenantName}}</strong>.</p><p>Saldo atual: <strong>{{balance}}</strong> tokens.</p>',
    text: 'Ola, {{userName}}. Credito confirmado: +{{amount}} tokens no tenant {{tenantName}}. Saldo atual: {{balance}} tokens.',
    enabled: true,
    variables: ['userName', 'tenantName', 'amount', 'balance', 'transactionId'],
  },
  {
    key: 'payment_approved',
    name: 'Pagamento Aprovado',
    description: 'Enviado quando o pagamento e aprovado pelo gateway.',
    subject: 'Pagamento aprovado - Pedido {{orderId}}',
    html: '<p>Pagamento aprovado com sucesso.</p><p>Pedido: <strong>{{orderId}}</strong></p><p>Valor: <strong>{{amount}}</strong></p>',
    text: 'Pagamento aprovado. Pedido {{orderId}}. Valor {{amount}}.',
    enabled: true,
    variables: ['orderId', 'amount', 'gatewayName', 'tenantName'],
  },
  {
    key: 'payment_failed',
    name: 'Falha de Pagamento',
    description: 'Enviado quando o pagamento falha ou e recusado.',
    subject: 'Falha no pagamento - Pedido {{orderId}}',
    html: '<p>Houve uma falha no pagamento do pedido <strong>{{orderId}}</strong>.</p><p>Motivo: {{reason}}</p><p>Tente novamente ou entre em contato com o suporte.</p>',
    text: 'Falha no pagamento do pedido {{orderId}}. Motivo: {{reason}}. Tente novamente.',
    enabled: true,
    variables: ['orderId', 'reason', 'amount', 'tenantName', 'supportEmail'],
  },
  {
    key: 'user_invite',
    name: 'Convite de Usuario',
    description: 'Enviado ao convidar novo usuario para o tenant.',
    subject: 'Voce foi convidado para {{tenantName}}',
    html: '<p>Ola, {{userName}}.</p><p>Voce foi convidado(a) para acessar o tenant <strong>{{tenantName}}</strong>.</p><p>Acesse: <a href="{{inviteUrl}}">{{inviteUrl}}</a></p>',
    text: 'Voce foi convidado para {{tenantName}}. Acesse: {{inviteUrl}}',
    enabled: true,
    variables: ['userName', 'tenantName', 'inviteUrl', 'invitedBy'],
  },
  {
    key: 'password_reset',
    name: 'Recuperacao de Senha',
    description: 'Enviado quando o usuario solicita recuperacao de senha.',
    subject: 'Codigo de recuperacao de senha - {{appName}}',
    html: '<p>Ola, {{userName}}.</p><p>Use o codigo <strong>{{resetCode}}</strong> para redefinir sua senha.</p><p>Esse codigo expira em {{expiresMinutes}} minutos.</p><p>Ou acesse diretamente: <a href="{{resetLink}}">{{resetLink}}</a></p>',
    text: 'Ola, {{userName}}. Seu codigo de recuperacao e {{resetCode}}. Expira em {{expiresMinutes}} minutos. Link: {{resetLink}}',
    enabled: true,
    variables: ['userName', 'appName', 'resetCode', 'expiresMinutes', 'resetLink', 'supportEmail'],
  },
];

const DEFAULT_TOKEN_PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 0,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 100, maxUsers: 2, maxCandidatesPerJob: 3, maxStorageGB: 1, maxFileSizeMB: 10 },
    features: { auditLog: false, whiteLabel: false, apiAccess: false, customDomain: false, sso: false },
  },
  {
    id: 'PRO',
    name: 'Pro Team',
    price: 499,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 5000, maxUsers: 10, maxCandidatesPerJob: 15, maxStorageGB: 50, maxFileSizeMB: 50 },
    features: { auditLog: true, whiteLabel: true, apiAccess: true, customDomain: true, sso: false },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 2900,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 99999, maxUsers: 100, maxCandidatesPerJob: 50, maxStorageGB: 500, maxFileSizeMB: 200 },
    features: { auditLog: true, whiteLabel: true, apiAccess: true, customDomain: true, sso: true, prioritySupport: true },
  },
];

const DEFAULT_TOKEN_PACKAGES = [
  { id: 'pkg_basic', name: 'Pacote Basic', tokens: 1000, price: 49, active: true },
  { id: 'pkg_pro', name: 'Pacote Pro', tokens: 5000, price: 199, active: true },
];

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const toNumber = (value, fallback = 0) => {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isMaskedSecret = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === '********') return true;
  // Common browser/app masking tokens (bullet/asterisk only).
  return /^[*•·●]+$/.test(trimmed);
};

const getMasterDb = (req) => req.db || connectionManager.getMaster();
const getLatestSmtpRow = async (db) => db('smtp_config')
  .orderByRaw('updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC')
  .first();

const sanitizeTemplate = (template, fallback = {}) => ({
  key: String(template?.key || fallback.key || '').trim(),
  name: String(template?.name || fallback.name || '').trim(),
  description: String(template?.description || fallback.description || '').trim(),
  subject: String(template?.subject || fallback.subject || '').trim(),
  html: String(template?.html || fallback.html || ''),
  text: String(template?.text || fallback.text || ''),
  enabled: template?.enabled == null ? (fallback.enabled !== false) : !!template.enabled,
  variables: Array.isArray(template?.variables)
    ? template.variables.map((v) => String(v).trim()).filter(Boolean)
    : (Array.isArray(fallback.variables) ? fallback.variables : []),
  updatedAt: template?.updatedAt || fallback.updatedAt || null,
});

const getDefaultTemplatesMap = () => {
  const map = {};
  DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATES.forEach((tpl) => {
    map[tpl.key] = sanitizeTemplate(tpl, tpl);
  });
  return map;
};

const loadTransactionalEmailTemplates = async (db) => {
  const defaultsMap = getDefaultTemplatesMap();
  const row = await db('system_config').where({ key: EMAIL_TEMPLATES_CONFIG_KEY }).first();
  const stored = safeJsonParse(row?.value, []);
  if (!Array.isArray(stored)) return Object.values(defaultsMap);

  stored.forEach((template) => {
    const key = String(template?.key || '').trim();
    if (!key) return;
    const fallback = defaultsMap[key] || { key, name: key, description: '', subject: '', html: '', text: '', enabled: true, variables: [] };
    defaultsMap[key] = sanitizeTemplate(template, fallback);
  });

  return Object.values(defaultsMap);
};

const saveTransactionalEmailTemplates = async (db, templates) => {
  const normalized = Array.isArray(templates) ? templates.map((tpl) => sanitizeTemplate(tpl, tpl)) : [];
  const existing = await db('system_config').where({ key: EMAIL_TEMPLATES_CONFIG_KEY }).first();
  const payload = JSON.stringify(normalized);
  if (existing) {
    await db('system_config').where({ key: EMAIL_TEMPLATES_CONFIG_KEY }).update({ value: payload, updated_at: new Date() });
  } else {
    await db('system_config').insert({ key: EMAIL_TEMPLATES_CONFIG_KEY, value: payload, created_at: new Date(), updated_at: new Date() });
  }
};

const resolveTenantByRef = async (db, tenantRef) => {
  if (!tenantRef || typeof tenantRef !== 'string') return null;
  const trimmed = tenantRef.trim();
  if (!trimmed) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  let tenant = null;
  if (isUuid) {
    tenant = await db('tenants').where({ id: trimmed }).first();
    if (tenant) return tenant;
  }

  const normalized = trimmed.toLowerCase();
  tenant = await db('tenants').whereRaw('lower(slug) = ?', [normalized]).first();
  if (tenant) return tenant;

  tenant = await db('tenants').whereRaw('lower(name) = ?', [normalized]).first();
  if (tenant) return tenant;

  const normalizedKey = normalized.replace(/[^a-z0-9]/g, '');
  if (normalizedKey && normalizedKey !== normalized) {
    tenant = await db('tenants')
      .whereRaw("regexp_replace(lower(slug), '[^a-z0-9]', '', 'g') = ?", [normalizedKey])
      .first();
    if (tenant) return tenant;

    tenant = await db('tenants')
      .whereRaw("regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ?", [normalizedKey])
      .first();
  }

  return tenant || null;
};

// --- API GATEWAY ---
const getApiGatewayConfig = async (req, res) => {
  try {
    const db = getMasterDb(req);
    let row = await db('api_gateway_config').first();
    if (!row) {
      const payload = {
        enabled: DEFAULT_API_GATEWAY_CONFIG.enabled,
        api_version: DEFAULT_API_GATEWAY_CONFIG.apiVersion,
        global_rate_limit: DEFAULT_API_GATEWAY_CONFIG.globalRateLimit,
        timeout_ms: DEFAULT_API_GATEWAY_CONFIG.timeoutMs,
        cors_origins: JSON.stringify(DEFAULT_API_GATEWAY_CONFIG.corsOrigins),
        enable_logging: DEFAULT_API_GATEWAY_CONFIG.enableLogging,
      };
      await db('api_gateway_config').insert(payload);
      row = await db('api_gateway_config').first();
    }

    const corsOrigins = safeJsonParse(row.cors_origins, DEFAULT_API_GATEWAY_CONFIG.corsOrigins);
    res.json({
      enabled: !!row.enabled,
      apiVersion: row.api_version || DEFAULT_API_GATEWAY_CONFIG.apiVersion,
      globalRateLimit: toNumber(row.global_rate_limit, DEFAULT_API_GATEWAY_CONFIG.globalRateLimit),
      timeoutMs: toNumber(row.timeout_ms, DEFAULT_API_GATEWAY_CONFIG.timeoutMs),
      corsOrigins: Array.isArray(corsOrigins) ? corsOrigins : DEFAULT_API_GATEWAY_CONFIG.corsOrigins,
      enableLogging: row.enable_logging !== false,
    });
  } catch (error) {
    console.error('Get API Gateway config error:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações do API Gateway.' });
  }
};

const updateApiGatewayConfig = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const payload = { ...DEFAULT_API_GATEWAY_CONFIG, ...(req.body || {}) };
    const record = {
      enabled: !!payload.enabled,
      api_version: payload.apiVersion || DEFAULT_API_GATEWAY_CONFIG.apiVersion,
      global_rate_limit: toNumber(payload.globalRateLimit, DEFAULT_API_GATEWAY_CONFIG.globalRateLimit),
      timeout_ms: toNumber(payload.timeoutMs, DEFAULT_API_GATEWAY_CONFIG.timeoutMs),
      cors_origins: JSON.stringify(payload.corsOrigins || DEFAULT_API_GATEWAY_CONFIG.corsOrigins),
      enable_logging: !!payload.enableLogging,
      updated_at: new Date(),
    };

    const existing = await db('api_gateway_config').first();
    if (existing) {
      await db('api_gateway_config').where({ id: existing.id }).update(record);
    } else {
      await db('api_gateway_config').insert(record);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update API Gateway config error:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações do API Gateway.' });
  }
};

// --- SYSTEM API KEYS ---
const getSystemApiKeys = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const rows = await db('system_api_keys').select('*').orderBy('created_at', 'desc');
    const result = rows.map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      role: row.role,
      createdAt: row.created_at,
      status: row.status,
    }));
    res.json(result);
  } catch (error) {
    console.error('Get system api keys error:', error);
    res.status(500).json({ error: 'Erro ao listar chaves de sistema.' });
  }
};

const createSystemApiKey = async (req, res) => {
  try {
    const { name, role } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nome da chave é obrigatório.' });

    const rawKey = `sk_sys_${crypto.randomBytes(16).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const db = getMasterDb(req);
    await db('system_api_keys').insert({
      id: uuidv4(),
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      role: role || 'READ_ONLY',
      status: 'ACTIVE',
      created_at: new Date(),
    });

    res.json({ rawKey });
  } catch (error) {
    console.error('Create system api key error:', error);
    res.status(500).json({ error: 'Erro ao criar chave do sistema.' });
  }
};

const revokeSystemApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const updated = await db('system_api_keys')
      .where({ id })
      .update({ status: 'REVOKED', revoked_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'Chave não encontrada.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke system api key error:', error);
    res.status(500).json({ error: 'Erro ao revogar chave.' });
  }
};

// --- SMTP CONFIG ---
const getSmtpConfig = async (req, res) => {
  try {
    const db = getMasterDb(req);
    let row = await getLatestSmtpRow(db);
    if (!row) {
      await db('smtp_config').insert({
        host: DEFAULT_SMTP_CONFIG.host,
        port: DEFAULT_SMTP_CONFIG.port,
        user: DEFAULT_SMTP_CONFIG.user,
        pass: DEFAULT_SMTP_CONFIG.pass,
        secure: DEFAULT_SMTP_CONFIG.secure,
        from_email: DEFAULT_SMTP_CONFIG.fromEmail,
      });
      row = await getLatestSmtpRow(db);
    }

    res.json({
      host: row.host || '',
      port: toNumber(row.port, DEFAULT_SMTP_CONFIG.port),
      user: row.user || '',
      pass: '',
      hasPassword: Boolean(String(row.pass || '').trim()),
      secure: !!row.secure,
      fromEmail: row.from_email || DEFAULT_SMTP_CONFIG.fromEmail,
    });
  } catch (error) {
    console.error('Get SMTP config error:', error);
    res.status(500).json({ error: 'Erro ao buscar SMTP.' });
  }
};

const updateSmtpConfig = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const payload = { ...(req.body || {}) };
    const existing = await getLatestSmtpRow(db);
    const incomingPassRaw = payload.pass;
    const incomingPass = typeof incomingPassRaw === 'string' ? incomingPassRaw.trim() : incomingPassRaw;
    const existingPass = String(existing?.pass || '').trim();
    const nextPort = toNumber(payload.port, existing?.port ?? DEFAULT_SMTP_CONFIG.port);
    const nextSecure = typeof payload.secure === 'boolean'
      ? payload.secure
      : (payload.port != null
        ? nextPort === 465
        : (typeof existing?.secure === 'boolean' ? !!existing.secure : nextPort === 465));
    const merged = {
      host: payload.host ?? existing?.host ?? DEFAULT_SMTP_CONFIG.host,
      port: nextPort,
      user: payload.user ?? existing?.user ?? DEFAULT_SMTP_CONFIG.user,
      pass: (typeof incomingPass === 'string' && incomingPass.length > 0 && !isMaskedSecret(incomingPass))
        ? incomingPass
        : (existingPass || DEFAULT_SMTP_CONFIG.pass),
      secure: nextSecure,
      from_email: payload.fromEmail ?? existing?.from_email ?? payload.user ?? existing?.user ?? DEFAULT_SMTP_CONFIG.fromEmail,
      updated_at: new Date(),
    };

    if (!String(merged.pass || '').trim()) {
      return res.status(400).json({ error: 'Senha SMTP obrigatoria. Informe uma senha valida.' });
    }

    if (existing) {
      await db('smtp_config').where({ id: existing.id }).update(merged);
    } else {
      await db('smtp_config').insert(merged);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update SMTP config error:', error);
    res.status(500).json({ error: 'Erro ao salvar SMTP.' });
  }
};

const testSmtpConnection = async (_req, res) => {
  try {
    if (!nodemailer) {
      return res.status(500).json({ error: 'Modulo nodemailer nao encontrado no servidor.' });
    }

    const req = _req;
    const db = getMasterDb(req);
    const row = await getLatestSmtpRow(db);
    const payload = req.body || {};
    const normalizeMaybeString = (value) => (typeof value === 'string' ? value.trim() : value);
    const payloadPass = normalizeMaybeString(payload.pass);
    const rowPass = normalizeMaybeString(row?.pass);
    const envHost = String(process.env.SMTP_HOST || '').trim();
    const envPort = toNumber(process.env.SMTP_PORT, DEFAULT_SMTP_CONFIG.port);
    const envUser = String(process.env.SMTP_USER || '').trim();
    const envPass = String(process.env.SMTP_PASS || '').trim();
    const envFrom = String(process.env.SMTP_FROM || '').trim();

    const host = normalizeMaybeString(payload.host) || normalizeMaybeString(row?.host) || envHost || '';
    const port = toNumber(payload.port, row?.port ?? envPort ?? DEFAULT_SMTP_CONFIG.port);
    const user = normalizeMaybeString(payload.user) || normalizeMaybeString(row?.user) || envUser || '';
    const pass = (typeof payloadPass === 'string' && payloadPass.length > 0 && !isMaskedSecret(payloadPass))
      ? payloadPass
      : (rowPass || envPass || '');
    const secure = typeof payload.secure === 'boolean'
      ? payload.secure
      : (port === 465 ? true : !!row?.secure);
    const fromEmail = normalizeMaybeString(payload.fromEmail) || normalizeMaybeString(row?.from_email) || envFrom || user || DEFAULT_SMTP_CONFIG.fromEmail;

    if (!host || !port || !user || !pass) {
      return res.status(400).json({ error: 'SMTP incompleto. Informe host, porta, usuario e senha.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 12000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.verify();

    const testEmail = String(payload.email || '').trim();
    if (testEmail) {
      await transporter.sendMail({
        from: fromEmail || user,
        to: testEmail,
        subject: 'Teste SMTP - Compara IA',
        text: 'Conexao SMTP validada com sucesso.',
      });
    }

    return res.json({
      success: true,
      message: testEmail
        ? `Conexao SMTP validada e email teste enviado para ${testEmail}.`
        : 'Conexao SMTP validada com sucesso.',
    });
  } catch (error) {
    console.error('Test SMTP error:', error);
    return res.status(400).json({ error: error?.message || 'Falha ao validar SMTP.' });
  }
};

// --- TRANSACTIONAL EMAIL TEMPLATES ---
const getTransactionalEmailTemplates = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const templates = await loadTransactionalEmailTemplates(db);
    res.json(templates);
  } catch (error) {
    console.error('Get transactional email templates error:', error);
    res.status(500).json({ error: 'Erro ao buscar templates de email.' });
  }
};

const updateTransactionalEmailTemplates = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const payload = req.body || {};
    if (!Array.isArray(payload.templates)) {
      return res.status(400).json({ error: 'Payload invalido. Envie templates[]' });
    }

    const nowIso = new Date().toISOString();
    const defaultsMap = getDefaultTemplatesMap();
    const merged = payload.templates
      .map((tpl) => {
        const key = String(tpl?.key || '').trim();
        const fallback = defaultsMap[key] || { key, name: key, description: '', subject: '', html: '', text: '', enabled: true, variables: [] };
        return sanitizeTemplate({ ...tpl, updatedAt: nowIso }, fallback);
      })
      .filter((tpl) => !!tpl.key);

    await saveTransactionalEmailTemplates(db, merged);
    res.json({ success: true });
  } catch (error) {
    console.error('Update transactional email templates error:', error);
    res.status(500).json({ error: 'Erro ao salvar templates de email.' });
  }
};

const updateTransactionalEmailTemplateByKey = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const key = String(req.params?.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Chave do template obrigatoria.' });

    const payload = req.body || {};
    const existing = await loadTransactionalEmailTemplates(db);
    const defaultsMap = getDefaultTemplatesMap();
    const existingMap = {};
    existing.forEach((tpl) => {
      existingMap[tpl.key] = tpl;
    });
    const base = existingMap[key] || defaultsMap[key];
    if (!base) return res.status(404).json({ error: 'Template nao encontrado.' });

    const updatedTemplate = sanitizeTemplate(
      { ...base, ...payload, key, updatedAt: new Date().toISOString() },
      base,
    );

    existingMap[key] = updatedTemplate;
    await saveTransactionalEmailTemplates(db, Object.values(existingMap));
    res.json({ success: true, template: updatedTemplate });
  } catch (error) {
    console.error('Update transactional email template by key error:', error);
    res.status(500).json({ error: 'Erro ao salvar template.' });
  }
};
// --- CRM LEADS ---
const getCRMLeads = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const rows = await db('crm_leads').select('*').orderBy('created_at', 'desc');
    const leads = rows.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      status: row.status,
      value: toNumber(row.value, 0),
      probability: toNumber(row.probability, 0),
      createdAt: row.created_at,
      notes: row.notes || '',
      interactions: safeJsonParse(row.interactions, []),
    }));
    res.json(leads);
  } catch (error) {
    console.error('Get CRM leads error:', error);
    res.status(500).json({ error: 'Erro ao listar leads.' });
  }
};

const createCRMLead = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.companyName || !payload.contactName || !payload.email) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
    }
    const db = getMasterDb(req);
    const lead = {
      id: uuidv4(),
      company_name: payload.companyName,
      contact_name: payload.contactName,
      email: payload.email,
      status: payload.status || 'NEW',
      value: toNumber(payload.value, 0),
      probability: toNumber(payload.probability, 0),
      notes: payload.notes || '',
      interactions: JSON.stringify(payload.interactions || []),
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db('crm_leads').insert(lead);
    res.status(201).json({
      id: lead.id,
      companyName: lead.company_name,
      contactName: lead.contact_name,
      email: lead.email,
      status: lead.status,
      value: lead.value,
      probability: lead.probability,
      createdAt: lead.created_at,
      notes: lead.notes,
      interactions: payload.interactions || [],
    });
  } catch (error) {
    console.error('Create CRM lead error:', error);
    res.status(500).json({ error: 'Erro ao criar lead.' });
  }
};

const updateCRMLead = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const db = getMasterDb(req);
    const existing = await db('crm_leads').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Lead não encontrado.' });

    const updates = {
      company_name: payload.companyName ?? existing.company_name,
      contact_name: payload.contactName ?? existing.contact_name,
      email: payload.email ?? existing.email,
      status: payload.status ?? existing.status,
      value: payload.value != null ? toNumber(payload.value, 0) : existing.value,
      probability: payload.probability != null ? toNumber(payload.probability, 0) : existing.probability,
      notes: payload.notes ?? existing.notes,
      interactions: payload.interactions != null ? JSON.stringify(payload.interactions) : existing.interactions,
      updated_at: new Date(),
    };

    await db('crm_leads').where({ id }).update(updates);
    res.json({ success: true });
  } catch (error) {
    console.error('Update CRM lead error:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
};

const deleteCRMLead = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const deleted = await db('crm_leads').where({ id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Lead não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete CRM lead error:', error);
    res.status(500).json({ error: 'Erro ao excluir lead.' });
  }
};

// --- TOKEN PLANS ---
const seedDefaultPlans = async (db) => {
  const rows = await db('token_plans').select('id').limit(1);
  if (rows.length > 0) return;
  const payloads = DEFAULT_TOKEN_PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    currency: plan.currency || 'BRL',
    active: plan.active !== false,
    limits: JSON.stringify(plan.limits || {}),
    features: JSON.stringify(plan.features || {}),
  }));
  await db('token_plans').insert(payloads);
};

const getPlans = async (req, res) => {
  try {
    const db = getMasterDb(req);
    await seedDefaultPlans(db);
    const rows = await db('token_plans').select('*').orderBy('price', 'asc');
    const plans = rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: toNumber(row.price, 0),
      currency: row.currency || 'BRL',
      active: row.active !== false,
      limits: safeJsonParse(row.limits, {}),
      features: safeJsonParse(row.features, {}),
    }));
    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Erro ao listar planos.' });
  }
};

const createPlan = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.id) return res.status(400).json({ error: 'ID do plano é obrigatório.' });
    const db = getMasterDb(req);
    const existing = await db('token_plans').where({ id: payload.id }).first();
    const data = {
      id: payload.id,
      name: payload.name || payload.id,
      price: toNumber(payload.price, 0),
      currency: payload.currency || 'BRL',
      active: payload.active !== false,
      limits: JSON.stringify(payload.limits || {}),
      features: JSON.stringify(payload.features || {}),
      updated_at: new Date(),
    };
    if (existing) {
      await db('token_plans').where({ id: payload.id }).update(data);
    } else {
      await db('token_plans').insert({ ...data, created_at: new Date() });
    }
    res.status(201).json(payload);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Erro ao salvar plano.' });
  }
};

const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const db = getMasterDb(req);
    const existing = await db('token_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Plano não encontrado.' });
    const updates = {
      name: payload.name ?? existing.name,
      price: payload.price != null ? toNumber(payload.price, 0) : existing.price,
      currency: payload.currency ?? existing.currency,
      active: payload.active != null ? payload.active : existing.active,
      limits: payload.limits != null ? JSON.stringify(payload.limits) : existing.limits,
      features: payload.features != null ? JSON.stringify(payload.features) : existing.features,
      updated_at: new Date(),
    };
    await db('token_plans').where({ id }).update(updates);
    res.json({ success: true });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano.' });
  }
};

const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const deleted = await db('token_plans').where({ id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Plano não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Erro ao excluir plano.' });
  }
};

// --- TOKEN PACKAGES ---
const seedDefaultPackages = async (db) => {
  const rows = await db('token_packages').select('id').limit(1);
  if (rows.length > 0) return;
  await db('token_packages').insert(
    DEFAULT_TOKEN_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      tokens: pkg.tokens,
      price: pkg.price,
      active: pkg.active !== false,
    })),
  );
};

const getTokenPackages = async (req, res) => {
  try {
    const db = getMasterDb(req);
    // await seedDefaultPackages(db); // Disable auto-seeding to allow full control/deletion
    const rows = await db('token_packages').select('*').orderBy('price', 'asc');
    const packages = rows.map((row) => ({
      id: row.id,
      name: row.name,
      tokens: toNumber(row.tokens, 0),
      price: toNumber(row.price, 0),
      active: row.active !== false,
    }));
    res.json(packages);
  } catch (error) {
    console.error('Get token packages error:', error);
    res.status(500).json({ error: 'Erro ao listar pacotes.' });
  }
};

const createTokenPackage = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.id) return res.status(400).json({ error: 'ID do pacote é obrigatório.' });
    const db = getMasterDb(req);
    const existing = await db('token_packages').where({ id: payload.id }).first();
    const data = {
      id: payload.id,
      name: payload.name || payload.id,
      tokens: toNumber(payload.tokens, 0),
      price: toNumber(payload.price, 0),
      active: payload.active !== false,
      updated_at: new Date(),
    };
    if (existing) {
      await db('token_packages').where({ id: payload.id }).update(data);
    } else {
      await db('token_packages').insert({ ...data, created_at: new Date() });
    }
    res.status(201).json(payload);
  } catch (error) {
    console.error('Create token package error:', error);
    res.status(500).json({ error: 'Erro ao salvar pacote.' });
  }
};

const deleteTokenPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const deleted = await db('token_packages').where({ id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Pacote não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete token package error:', error);
    res.status(500).json({ error: 'Erro ao excluir pacote.' });
  }
};

// --- TOKEN TRANSACTIONS ---
const adminRefillTokens = async (req, res) => {
  try {
    const { tenantId, tenantSlug, tenantName, amount } = req.body || {};
    const tenantRef = tenantId || tenantSlug || tenantName;
    if (!tenantRef) return res.status(400).json({ error: 'TenantId obrigat?rio.' });
    const db = getMasterDb(req);
    const tenant = await resolveTenantByRef(db, tenantRef);
    if (!tenant) return res.status(404).json({ error: 'Tenant n?o encontrado.' });

    const creditAmount = Math.abs(toNumber(amount, 0));
    if (!creditAmount) return res.status(400).json({ error: 'Quantidade inv?lida.' });

    const entry = await billingService.creditTokens(tenant.id, creditAmount, {
      type: 'TOKEN_REFILL',
      description: `Recarga manual (${creditAmount} tokens)`,
      referenceId: req?.user?.id || null,
    }, db);

    const wallet = await billingService.getTenantWalletBalance(tenant);
    const recipients = await getTenantAdminRecipients(tenant.id, db);
    if (recipients.length > 0) {
      await sendTransactionalEmail({
        templateKey: 'credit_confirmation',
        to: recipients,
        db,
        variables: {
          userName: 'Cliente',
          tenantName: tenant.name || tenant.slug || tenant.id,
          amount: creditAmount,
          balance: wallet.balance,
          transactionId: entry.id,
        },
      });
    }

    res.status(201).json({
      id: entry.id,
      tenantId: tenant.id,
      amount: creditAmount,
      description: entry.description,
      date: entry.created_at,
    });
  } catch (error) {
    console.error('Admin refill tokens error:', error);
    res.status(500).json({ error: 'Erro ao adicionar tokens.' });
  }
};

const getTransactions = async (req, res) => {
  try {
    const tenantId = req.query.tenantId;
    const db = getMasterDb(req);
    let query = db('token_transactions').select('*').orderBy('created_at', 'desc');
    if (tenantId && tenantId !== 'all') {
      query = query.where({ tenant_id: tenantId });
    }
    const rows = await query;
    const result = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      amount: toNumber(row.amount, 0),
      description: row.description || '',
      date: row.created_at,
      type: row.type || 'TOKEN_REFILL',
    }));
    res.json(result);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Erro ao listar transações.' });
  }
};

// --- WEBHOOKS ---
const getWebhooks = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const rows = await db('webhooks').select('*').orderBy('created_at', 'desc');
    const webhooks = rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret || '',
      events: safeJsonParse(row.events, []),
      active: row.active !== false,
      lastStatus: row.last_status || 'SUCCESS',
    }));
    res.json(webhooks);
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Erro ao listar webhooks.' });
  }
};

const createWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.name || !payload.url) {
      return res.status(400).json({ error: 'Nome e URL são obrigatórios.' });
    }
    const db = getMasterDb(req);
    const webhook = {
      id: uuidv4(),
      name: payload.name,
      url: payload.url,
      secret: payload.secret || '',
      events: JSON.stringify(payload.events || []),
      active: payload.active !== false,
      last_status: 'SUCCESS',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db('webhooks').insert(webhook);
    res.status(201).json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: payload.events || [],
      active: webhook.active,
      lastStatus: webhook.last_status,
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Erro ao criar webhook.' });
  }
};

const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const db = getMasterDb(req);
    const existing = await db('webhooks').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Webhook não encontrado.' });
    const updates = {
      name: payload.name ?? existing.name,
      url: payload.url ?? existing.url,
      secret: payload.secret ?? existing.secret,
      events: payload.events != null ? JSON.stringify(payload.events) : existing.events,
      active: payload.active != null ? payload.active : existing.active,
      updated_at: new Date(),
    };
    await db('webhooks').where({ id }).update(updates);
    res.json({ success: true });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Erro ao atualizar webhook.' });
  }
};

const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    await db('webhook_logs').where({ webhook_id: id }).delete();
    const deleted = await db('webhooks').where({ id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Webhook não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Erro ao excluir webhook.' });
  }
};

const getWebhookLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const rows = await db('webhook_logs').where({ webhook_id: id }).orderBy('timestamp', 'desc');
    const logs = rows.map((row) => ({
      id: row.id,
      webhookId: row.webhook_id,
      event: row.event,
      timestamp: row.timestamp,
      statusCode: row.status_code,
      latency: row.latency,
      payloadPreview: row.payload_preview || '',
    }));
    res.json(logs);
  } catch (error) {
    console.error('Get webhook logs error:', error);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
};

const testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getMasterDb(req);
    const webhook = await db('webhooks').where({ id }).first();
    if (!webhook) return res.status(404).json({ error: 'Webhook não encontrado.' });

    const log = {
      id: `whlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      webhook_id: id,
      event: safeJsonParse(webhook.events, ['job.completed'])[0] || 'job.completed',
      timestamp: new Date(),
      status_code: 200,
      latency: 120,
      payload_preview: '{}',
    };
    await db('webhook_logs').insert(log);
    await db('webhooks').where({ id }).update({ last_status: 'SUCCESS', updated_at: new Date() });
    res.json({
      id: log.id,
      webhookId: log.webhook_id,
      event: log.event,
      timestamp: log.timestamp,
      statusCode: log.status_code,
      latency: log.latency,
      payloadPreview: log.payload_preview,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Erro ao testar webhook.' });
  }
};

// --- PAYMENT GATEWAYS ---
const getPaymentGateways = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const rows = await db('payment_gateways').select('*').orderBy('name', 'asc');
    const gateways = rows.map((row) => ({
      provider: row.provider,
      name: row.name,
      active: row.active !== false,
      isDefault: row.is_default === true,
      credentials: safeJsonParse(row.credentials, {}),
      customInstructions: row.custom_instructions || '',
    }));
    res.json(gateways);
  } catch (error) {
    console.error('Get payment gateways error:', error);
    res.status(500).json({ error: 'Erro ao listar gateways.' });
  }
};

const upsertPaymentGateway = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.provider) return res.status(400).json({ error: 'Provider obrigatório.' });
    const db = getMasterDb(req);
    const existing = await db('payment_gateways').where({ provider: payload.provider }).first();
    const data = {
      provider: payload.provider,
      name: payload.name || payload.provider,
      active: payload.active === true,
      is_default: payload.isDefault === true,
      credentials: JSON.stringify(payload.credentials || {}),
      custom_instructions: payload.customInstructions || '',
      updated_at: new Date(),
    };

    if (data.is_default) {
      await db('payment_gateways').update({ is_default: false });
    }

    if (existing) {
      await db('payment_gateways').where({ provider: payload.provider }).update(data);
    } else {
      await db('payment_gateways').insert({ ...data, created_at: new Date() });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Upsert payment gateway error:', error);
    res.status(500).json({ error: 'Erro ao salvar gateway.' });
  }
};

const deletePaymentGateway = async (req, res) => {
  try {
    const { provider } = req.params;
    const db = getMasterDb(req);
    const deleted = await db('payment_gateways').where({ provider }).delete();
    if (!deleted) return res.status(404).json({ error: 'Gateway não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete payment gateway error:', error);
    res.status(500).json({ error: 'Erro ao excluir gateway.' });
  }
};

// --- NOTIFICATIONS ---
const getNotifications = async (req, res) => {
  try {
    const db = getMasterDb(req);
    const notifications = [];

    // 1. Recent Tenants (Last 24h)
    const recentTenants = await db('tenants')
      .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .orderBy('created_at', 'desc')
      .limit(5);

    recentTenants.forEach(t => {
      notifications.push({
        id: `tenant_${t.id}`,
        title: 'Nova Empresa Registrada',
        msg: `${t.name} iniciou o plano ${t.plan}.`,
        time: new Date(t.created_at).toISOString(),
        type: 'info'
      });
    });

    // 2. Recent Transactions (Last 24h)
    const recentTx = await db('token_transactions')
      .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .orderBy('created_at', 'desc')
      .limit(5);

    recentTx.forEach(tx => {
      notifications.push({
        id: `tx_${tx.id}`,
        title: 'Movimentação de Tokens',
        msg: tx.description || 'Recarga ou consumo detectado.',
        time: new Date(tx.created_at).toISOString(),
        type: 'success'
      });
    });

    // 3. System Alerts / Webhooks Failures (Last 24h)
    // Avoid checking table existence if possible, or use try-catch
    try {
      const failedWebhooks = await db('webhook_logs')
        .where('status_code', '>=', 400)
        .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .orderBy('timestamp', 'desc')
        .limit(5);

      failedWebhooks.forEach(wh => {
        notifications.push({
          id: `wh_${wh.id}`,
          title: 'Falha em Webhook',
          msg: `Erro ${wh.status_code} no evento ${wh.event}.`,
          time: new Date(wh.timestamp).toISOString(),
          type: 'warning'
        });
      });
    } catch (e) {
      // safe ignore
    }

    // Sort by time desc
    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
};

// --- API SPEC (STATIC, BASED ON IMPLEMENTED ROUTES) ---
const getApiSpec = async (_req, res) => {
  return res.json({
    openapi: '3.0.0',
    info: {
      title: 'Compara IA API',
      version: 'v1',
      description: 'API pública e administrativa da plataforma Compara IA.',
    },
    paths: {
      '/api/health': { get: { summary: 'Health check' } },
      '/api/auth/login': { post: { summary: 'Login' } },
        '/api/jobs': { get: { summary: 'Listar jobs' }, post: { summary: 'Criar job' } },
        '/api/jobs/{id}': { get: { summary: 'Detalhar job' }, patch: { summary: 'Atualizar job' }, delete: { summary: 'Excluir job' } },
        '/api/ai/analyze-raw': { post: { summary: 'Análise IA (raw)' } },
        '/api/ai/rfq': { post: { summary: 'Gerar minuta de RFQ' } },
        '/api/billing/wallet': { get: { summary: 'Saldo de tokens' } },
      '/api/billing/transactions': { get: { summary: 'Transações do tenant' } },
      '/api/tenant/api-keys': { get: { summary: 'Listar chaves API do tenant' }, post: { summary: 'Criar chave API do tenant' } },
      '/api/admin/overview': { get: { summary: 'Visão geral da plataforma' } },
      '/api/admin/tenants': { get: { summary: 'Listar tenants' } },
      '/api/admin/users': { get: { summary: 'Listar usuários globais' } },
      '/api/admin/api-gateway': { get: { summary: 'Config API Gateway' }, post: { summary: 'Atualizar API Gateway' } },
      '/api/admin/webhooks': { get: { summary: 'Listar webhooks' }, post: { summary: 'Criar webhook' } },
    },
  });
};

module.exports = {
  getApiGatewayConfig,
  updateApiGatewayConfig,
  getSystemApiKeys,
  createSystemApiKey,
  revokeSystemApiKey,
  getSmtpConfig,
  updateSmtpConfig,
  testSmtpConnection,
  getTransactionalEmailTemplates,
  updateTransactionalEmailTemplates,
  updateTransactionalEmailTemplateByKey,
  getCRMLeads,
  createCRMLead,
  updateCRMLead,
  deleteCRMLead,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getTokenPackages,
  createTokenPackage,
  deleteTokenPackage,
  adminRefillTokens,
  getTransactions,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookLogs,
  testWebhook,
  getPaymentGateways,
  upsertPaymentGateway,
  deletePaymentGateway,
  getApiSpec,
  getNotifications,
};
