const { startTestServer } = require('./testServer');

const MASTER_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'contato@inctec.com.br';
const MASTER_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || 'Caio*1991';

function tenantHeaders(slug, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (slug) headers['X-Tenant-ID'] = slug;
  return headers;
}

async function loginMaster() {
  const api = startTestServer();
  const res = await api
    .post('/api/auth/login')
    .send({ email: MASTER_EMAIL, password: MASTER_PASSWORD })
    .expect(200);
  return res.body;
}

async function registerTenant(adminToken, payloadOverride = {}) {
  const api = startTestServer();
  const slug = `tenant-test-${Date.now()}`;
  const body = {
    name: 'Tenant Teste',
    email: `owner+${slug}@example.com`,
    slug,
    plan: 'STARTER',
    adminName: 'Owner Test',
    password: 'Passw0rd!',
    ...payloadOverride,
    slug: payloadOverride.slug || slug,
  };

  const res = await api
    .post('/api/register-tenant')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
  return { response: res, slug: body.slug, ownerEmail: body.email, ownerPass: body.password };
}

async function loginTenant(slug, email, password) {
  const api = startTestServer();
  const res = await api
    .post('/api/auth/login')
    .set(tenantHeaders(slug))
    .send({ email, password });
  return res;
}

module.exports = { tenantHeaders, loginMaster, registerTenant, loginTenant };
