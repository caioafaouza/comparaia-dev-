const connectionManager = require('../db/connectionManager');

let nodemailer = null;
try {
  // Optional at runtime; if missing, service will fail gracefully.
  // Add "nodemailer" to server/package.json dependencies in this patch.
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const EMAIL_TEMPLATES_CONFIG_KEY = 'TRANSACTIONAL_EMAIL_TEMPLATES';
const EMAIL_BRANDING_CONFIG_KEY = 'TRANSACTIONAL_EMAIL_BRANDING';

const DEFAULT_TRANSACTIONAL_EMAIL_BRANDING = {
  enabled: true,
  logoUrl: '',
  headerHtml: '',
  signatureHtml: '',
  footerHtml: '',
  cardBackgroundColor: '#ffffff',
  pageBackgroundColor: '#f8fafc',
  cardBorderColor: '#e2e8f0',
};

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

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeTemplate = (tpl, fallback = {}) => ({
  key: String(tpl?.key || fallback.key || '').trim(),
  name: String(tpl?.name || fallback.name || '').trim(),
  description: String(tpl?.description || fallback.description || '').trim(),
  subject: String(tpl?.subject || fallback.subject || ''),
  html: String(tpl?.html || fallback.html || ''),
  text: String(tpl?.text || fallback.text || ''),
  enabled: tpl?.enabled == null ? (fallback.enabled !== false) : !!tpl.enabled,
  variables: Array.isArray(tpl?.variables) ? tpl.variables : (Array.isArray(fallback.variables) ? fallback.variables : []),
  updatedAt: tpl?.updatedAt || fallback.updatedAt || null,
});

const getDefaultTemplatesMap = () => {
  const map = {};
  DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATES.forEach((tpl) => {
    map[tpl.key] = normalizeTemplate(tpl, tpl);
  });
  return map;
};

const mergeStoredTemplates = (storedTemplates) => {
  const base = getDefaultTemplatesMap();
  if (!Array.isArray(storedTemplates)) return Object.values(base);
  storedTemplates.forEach((tpl) => {
    const key = String(tpl?.key || '').trim();
    if (!key) return;
    const fallback = base[key] || { key, name: key, description: '', subject: '', html: '', text: '', enabled: true, variables: [] };
    base[key] = normalizeTemplate(tpl, fallback);
  });
  return Object.values(base);
};

const renderTemplate = (input, variables = {}) => {
  const text = String(input || '');
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
};

const sanitizeBrandingConfig = (input = {}) => {
  const cfg = input && typeof input === 'object' ? input : {};
  return {
    enabled: cfg.enabled !== false,
    logoUrl: String(cfg.logoUrl || ''),
    headerHtml: String(cfg.headerHtml || ''),
    signatureHtml: String(cfg.signatureHtml || ''),
    footerHtml: String(cfg.footerHtml || ''),
    cardBackgroundColor: String(cfg.cardBackgroundColor || DEFAULT_TRANSACTIONAL_EMAIL_BRANDING.cardBackgroundColor),
    pageBackgroundColor: String(cfg.pageBackgroundColor || DEFAULT_TRANSACTIONAL_EMAIL_BRANDING.pageBackgroundColor),
    cardBorderColor: String(cfg.cardBorderColor || DEFAULT_TRANSACTIONAL_EMAIL_BRANDING.cardBorderColor),
  };
};

const getTransactionalEmailBrandingConfig = async (db) => {
  const row = await db('system_config').where({ key: EMAIL_BRANDING_CONFIG_KEY }).first();
  const stored = safeJsonParse(row?.value, {});
  return sanitizeBrandingConfig({ ...DEFAULT_TRANSACTIONAL_EMAIL_BRANDING, ...(stored || {}) });
};

const buildEmailLayoutHtml = (bodyHtml, branding, variables = {}) => {
  if (!branding?.enabled) return bodyHtml;

  const renderedHeaderHtml = renderTemplate(branding.headerHtml, variables).trim();
  const renderedSignatureHtml = renderTemplate(branding.signatureHtml, variables).trim();
  const renderedFooterHtml = renderTemplate(branding.footerHtml, variables).trim();

  const logoUrl = String(variables.logoUrl || branding.logoUrl || '').trim();
  const logoBlock = logoUrl
    ? `<div style="margin-bottom:16px;"><img src="${logoUrl}" alt="Logo" style="max-width:180px;height:auto;display:block;" /></div>`
    : '';
  const headerBlock = renderedHeaderHtml
    ? `<div style="margin-bottom:16px;">${renderedHeaderHtml}</div>`
    : '';
  const signatureBlock = renderedSignatureHtml
    ? `<div style="margin-top:20px;">${renderedSignatureHtml}</div>`
    : '';
  const footerBlock = renderedFooterHtml
    ? `<div style="margin-top:24px;padding-top:14px;border-top:1px solid ${branding.cardBorderColor};font-size:12px;color:#64748b;">${renderedFooterHtml}</div>`
    : '';

  return `
  <div style="margin:0;padding:24px;background:${branding.pageBackgroundColor};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:${branding.cardBackgroundColor};border:1px solid ${branding.cardBorderColor};border-radius:12px;padding:24px;">
      ${logoBlock}
      ${headerBlock}
      <div>${bodyHtml || ''}</div>
      ${signatureBlock}
      ${footerBlock}
    </div>
  </div>
  `.trim();
};

const getMasterDb = () => connectionManager.getMaster();

const getLatestSmtpRow = async (db) => db('smtp_config')
  .orderByRaw('updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC')
  .first();

const getGlobalConfig = async (db) => {
  const row = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
  const cfg = safeJsonParse(row?.value, {});
  return cfg && typeof cfg === 'object' ? cfg : {};
};

const getSmtpConfig = async (db) => {
  const row = await getLatestSmtpRow(db);
  const envHost = String(process.env.SMTP_HOST || '').trim();
  const envPort = Number(process.env.SMTP_PORT || 587);
  const envUser = String(process.env.SMTP_USER || '').trim();
  const envPass = String(process.env.SMTP_PASS || '').trim();
  const envFrom = String(process.env.SMTP_FROM || '').trim();

  if (!row && !envHost) return null;
  const port = Number(row?.port || envPort || 587);
  return {
    host: String(row?.host || envHost || '').trim(),
    port,
    user: String(row?.user || envUser || '').trim(),
    pass: String(row?.pass || envPass || '').trim(),
    secure: typeof row?.secure === 'boolean' ? !!row.secure : port === 465,
    fromEmail: String(row?.from_email || envFrom || row?.user || envUser || '').trim(),
  };
};

const getTransactionalEmailTemplates = async (db = null) => {
  const masterDb = db || getMasterDb();
  const row = await masterDb('system_config').where({ key: EMAIL_TEMPLATES_CONFIG_KEY }).first();
  const stored = safeJsonParse(row?.value, []);
  return mergeStoredTemplates(stored);
};

const getTemplateByKey = async (key, db = null) => {
  const templates = await getTransactionalEmailTemplates(db);
  return templates.find((tpl) => tpl.key === key) || null;
};

const getTenantAdminRecipients = async (tenantId, db = null) => {
  if (!tenantId) return [];
  const masterDb = db || getMasterDb();
  const hasUserTenants = await masterDb.schema.hasTable('user_tenants');
  const recipients = new Set();

  if (hasUserTenants) {
    const rows = await masterDb('user_tenants')
      .join('users', 'users.id', 'user_tenants.user_id')
      .where('user_tenants.tenant_id', tenantId)
      .where('users.status', 'ACTIVE')
      .select('users.email');
    rows.forEach((row) => {
      const email = String(row.email || '').trim().toLowerCase();
      if (email) recipients.add(email);
    });
  }

  if (recipients.size > 0) return Array.from(recipients);

  const tenant = await masterDb('tenants').where({ id: tenantId }).first();
  if (tenant?.db_name) {
    try {
      const rows = await masterDb
        .withSchema(tenant.db_name)
        .from('users')
        .whereIn('role', ['OWNER', 'ADMIN'])
        .where('status', 'ACTIVE')
        .select('email');
      rows.forEach((row) => {
        const email = String(row.email || '').trim().toLowerCase();
        if (email) recipients.add(email);
      });
    } catch {
      // ignore tenant-schema lookup failures
    }
  }

  return Array.from(recipients);
};

const sendTransactionalEmail = async ({
  templateKey,
  to,
  variables = {},
  db = null,
  cc,
  bcc,
}) => {
  try {
    if (!nodemailer) {
      return { sent: false, reason: 'nodemailer_not_installed' };
    }

    const recipients = (Array.isArray(to) ? to : [to])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      return { sent: false, reason: 'no_recipients' };
    }

    const masterDb = db || getMasterDb();
    const smtp = await getSmtpConfig(masterDb);
    if (!smtp || !smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
      return { sent: false, reason: 'smtp_not_configured' };
    }

    const template = await getTemplateByKey(templateKey, masterDb);
    if (!template) return { sent: false, reason: 'template_not_found' };
    if (!template.enabled) return { sent: false, reason: 'template_disabled' };
    const branding = await getTransactionalEmailBrandingConfig(masterDb);

    const globalConfig = await getGlobalConfig(masterDb);
    const mergedVars = {
      appName: globalConfig.appName || 'Compara IA',
      supportEmail: globalConfig.supportEmail || smtp.fromEmail,
      logoUrl: branding.logoUrl || globalConfig?.branding?.logoUrl || '',
      emailHeaderHtml: branding.headerHtml || '',
      emailSignatureHtml: branding.signatureHtml || '',
      emailFooterHtml: branding.footerHtml || '',
      ...variables,
    };

    const subject = renderTemplate(template.subject, mergedVars);
    const rawHtml = renderTemplate(template.html, mergedVars);
    const html = buildEmailLayoutHtml(rawHtml, branding, mergedVars);
    const text = renderTemplate(template.text, mergedVars);

    const secure = typeof smtp.secure === 'boolean' ? smtp.secure : Number(smtp.port) === 465;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: secure || Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    const info = await transporter.sendMail({
      from: smtp.fromEmail || smtp.user,
      to: recipients.join(', '),
      cc,
      bcc,
      subject,
      html,
      text,
    });

    return { sent: true, messageId: info?.messageId || null };
  } catch (error) {
    return { sent: false, reason: error?.message || 'send_failed' };
  }
};

module.exports = {
  DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATES,
  DEFAULT_TRANSACTIONAL_EMAIL_BRANDING,
  getTransactionalEmailTemplates,
  getTransactionalEmailBrandingConfig,
  getTemplateByKey,
  getTenantAdminRecipients,
  sendTransactionalEmail,
};
