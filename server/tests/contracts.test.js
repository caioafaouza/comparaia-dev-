const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');
const { healthSchema, authLoginSchema, jobsListSchema } = require('./contracts/schemas');

describe('Contracts / Schemas', () => {
  test('contracts.health.schema', async () => {
    const res = await startTestServer().get('/api/health').expect(200);
    const parsed = healthSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  test('contracts.auth.login.schema', async () => {
    const master = await loginMaster();
    const parsed = authLoginSchema.safeParse(master);
    expect(parsed.success).toBe(true);
  });

  test('contracts.jobs.list.schema', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant(slug, ownerEmail, ownerPass);

    // cria um job mínimo
    await startTestServer()
      .post('/api/jobs')
      .set(tenantHeaders(slug, login.body.token))
      .field('userId', login.body.user.id)
      .attach('referenceFile', require('path').join(__dirname, 'fixtures', 'sample.txt'))
      .attach('candidateFiles', require('path').join(__dirname, 'fixtures', 'sample.txt'))
      .expect(200);

    const res = await startTestServer()
      .get('/api/jobs')
      .set(tenantHeaders(slug, login.body.token))
      .expect(200);

    const parsed = jobsListSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });
});
