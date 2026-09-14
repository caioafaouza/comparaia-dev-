require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'contato@inctec.com.br';
const ADMIN_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || '';

const request = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
};

const assertOk = (label, result) => {
  if (!result.ok) {
    console.log(`\u274c ${label} -> ${result.status}`, result.data || '');
    return false;
  }
  console.log(`\u2705 ${label}`);
  return true;
};

(async () => {
  console.log('--- ADMIN MODULES VALIDATION ---');

  if (!ADMIN_PASSWORD) {
    console.error('MASTER_ADMIN_PASSWORD not set');
    process.exit(1);
  }

  const login = await request('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!login.ok || !login.data?.token) {
    console.error('Login failed', login.status, login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log('\u2705 Login OK');

  // Infra connections
  const dbConn = await request('POST', '/api/admin/test-connection', { type: 'db' }, token);
  assertOk('POST /api/admin/test-connection (db)', dbConn);
  const redisConn = await request('POST', '/api/admin/test-connection', { type: 'redis' }, token);
  assertOk('POST /api/admin/test-connection (redis)', redisConn);
  const storageConn = await request('POST', '/api/admin/test-connection', { type: 'storage' }, token);
  assertOk('POST /api/admin/test-connection (storage)', storageConn);

  // API Gateway
  const apiCfg = await request('GET', '/api/admin/api-gateway', null, token);
  assertOk('GET /api/admin/api-gateway', apiCfg);
  if (apiCfg.ok) {
    await request('POST', '/api/admin/api-gateway', apiCfg.data, token);
    assertOk('POST /api/admin/api-gateway', { ok: true });
  }

  // System keys
  const keys = await request('GET', '/api/admin/system-keys', null, token);
  assertOk('GET /api/admin/system-keys', keys);
  const createdKey = await request('POST', '/api/admin/system-keys', { name: 'Smoke Test', role: 'READ_ONLY' }, token);
  assertOk('POST /api/admin/system-keys', createdKey);
  if (createdKey.ok) {
    const keysAfter = await request('GET', '/api/admin/system-keys', null, token);
    const revokeId = keysAfter.data?.[0]?.id;
    if (revokeId) {
      const revoke = await request('POST', `/api/admin/system-keys/${revokeId}/revoke`, {}, token);
      assertOk('POST /api/admin/system-keys/:id/revoke', revoke);
    }
  }

  // SMTP
  const smtp = await request('GET', '/api/admin/config/smtp', null, token);
  assertOk('GET /api/admin/config/smtp', smtp);
  if (smtp.ok) {
    await request('POST', '/api/admin/config/smtp', { host: smtp.data.host, port: smtp.data.port, user: smtp.data.user }, token);
    assertOk('POST /api/admin/config/smtp', { ok: true });
  }
  const smtpTest = await request('POST', '/api/admin/config/smtp/test', {}, token);
  assertOk('POST /api/admin/config/smtp/test', smtpTest);

  // CRM Leads
  const publicLead = await request('POST', '/api/crm/leads', {
    companyName: 'Smoke Test Co',
    contactName: 'QA Bot',
    email: 'qa.bot@example.com',
    notes: 'Smoke test lead',
  });
  assertOk('POST /api/crm/leads (public)', publicLead);
  const crm = await request('GET', '/api/admin/crm/leads', null, token);
  assertOk('GET /api/admin/crm/leads', crm);
  if (publicLead.ok && publicLead.data?.id) {
    const delLead = await request('DELETE', `/api/admin/crm/leads/${publicLead.data.id}`, null, token);
    assertOk('DELETE /api/admin/crm/leads/:id', delLead);
  }

  // Plans
  const plans = await request('GET', '/api/admin/plans', null, token);
  assertOk('GET /api/admin/plans', plans);
  const planId = `SMOKE_${Date.now()}`;
  const createPlan = await request('POST', '/api/admin/plans', {
    id: planId,
    name: 'Smoke Plan',
    price: 1,
    currency: 'BRL',
    limits: { monthlyTokens: 10, maxUsers: 1, maxCandidatesPerJob: 1, maxStorageGB: 1, maxFileSizeMB: 5 },
    features: { auditLog: false, whiteLabel: false, apiAccess: false, customDomain: false, sso: false },
  }, token);
  assertOk('POST /api/admin/plans', createPlan);
  const delPlan = await request('DELETE', `/api/admin/plans/${planId}`, null, token);
  assertOk('DELETE /api/admin/plans/:id', delPlan);

  // Token packages
  const packages = await request('GET', '/api/admin/token-packages', null, token);
  assertOk('GET /api/admin/token-packages', packages);
  const pkgId = `pkg_smoke_${Date.now()}`;
  const createPkg = await request('POST', '/api/admin/token-packages', {
    id: pkgId,
    name: 'Smoke Package',
    tokens: 100,
    price: 9,
    active: true,
  }, token);
  assertOk('POST /api/admin/token-packages', createPkg);
  const delPkg = await request('DELETE', `/api/admin/token-packages/${pkgId}`, null, token);
  assertOk('DELETE /api/admin/token-packages/:id', delPkg);

  // Token refill + transactions
  const refill = await request('POST', '/api/admin/tokens/refill', { tenantId: 'smoke_tenant', amount: 25 }, token);
  assertOk('POST /api/admin/tokens/refill', refill);
  const txs = await request('GET', '/api/admin/transactions?tenantId=smoke_tenant', null, token);
  assertOk('GET /api/admin/transactions', txs);

  // Webhooks
  const webhook = await request('POST', '/api/admin/webhooks', {
    name: 'Smoke Webhook',
    url: 'https://example.com/webhook',
    secret: 'whsec_smoke',
    events: ['job.completed'],
    active: true,
  }, token);
  assertOk('POST /api/admin/webhooks', webhook);
  const whList = await request('GET', '/api/admin/webhooks', null, token);
  assertOk('GET /api/admin/webhooks', whList);
  if (webhook.ok && webhook.data?.id) {
    const whTest = await request('POST', `/api/admin/webhooks/${webhook.data.id}/test`, {}, token);
    assertOk('POST /api/admin/webhooks/:id/test', whTest);
    const whLogs = await request('GET', `/api/admin/webhooks/${webhook.data.id}/logs`, null, token);
    assertOk('GET /api/admin/webhooks/:id/logs', whLogs);
    const whDelete = await request('DELETE', `/api/admin/webhooks/${webhook.data.id}`, null, token);
    assertOk('DELETE /api/admin/webhooks/:id', whDelete);
  }

  // Payment gateways
  const pg = await request('GET', '/api/admin/payment-gateways', null, token);
  assertOk('GET /api/admin/payment-gateways', pg);

  console.log('--- VALIDATION COMPLETE ---');
})();
