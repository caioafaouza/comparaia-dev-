const { startTestServer, resetTestServer } = require('./helpers/testServer');

describe('Rate limit policies', () => {
  beforeAll(() => {
    process.env.TEST_RATE_LIMIT = 'true';
    resetTestServer();
  });

  afterAll(() => {
    delete process.env.TEST_RATE_LIMIT;
    resetTestServer();
  });

  test('login rate limit triggers after threshold', async () => {
    const api = startTestServer({ fresh: true });
    const masterEmail = process.env.MASTER_ADMIN_EMAIL || 'contato@inctec.com.br';

    // Two attempts allowed, third should be 429
    await api
      .post('/api/auth/login')
      .send({ email: masterEmail, password: 'bad-password' })
      .expect(401);

    await api
      .post('/api/auth/login')
      .send({ email: masterEmail, password: 'bad-password' })
      .expect(401);

    await api
      .post('/api/auth/login')
      .send({ email: masterEmail, password: 'bad-password' })
      .expect(429);
  });

  test('ai analyze raw rate limit triggers', async () => {
    const api = startTestServer({ fresh: true });
    // create a tenant so resolver passes and auth middleware returns 401 for missing token
    const masterEmail = process.env.MASTER_ADMIN_EMAIL || 'contato@inctec.com.br';
    const masterPass = process.env.MASTER_ADMIN_PASSWORD || 'Caio*1991';
    const loginMasterRes = await api.post('/api/auth/login').send({ email: masterEmail, password: masterPass }).expect(200);
    const adminToken = loginMasterRes.body.token;
    const slug = `rl-${Date.now()}`;
    await api
      .post('/api/register-tenant')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'RL Tenant',
        email: `owner+${slug}@example.com`,
        slug,
        plan: 'STARTER',
        adminName: 'RL',
        password: 'Passw0rd!',
      })
      .expect(201);

    const headers = { 'X-Tenant-ID': slug };

    await api.post('/api/ai/analyze-raw').set(headers).send({}).expect(401);
    await api.post('/api/ai/analyze-raw').set(headers).send({}).expect(401);
    await api.post('/api/ai/analyze-raw').set(headers).send({}).expect(429);
  });
});
