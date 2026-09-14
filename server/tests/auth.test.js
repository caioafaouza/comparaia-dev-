const { startTestServer } = require('./helpers/testServer');
const { loginMaster, tenantHeaders, loginTenant, registerTenant } = require('./helpers/authUtils');

describe('Auth - master login', () => {
  test('auth.master.login.pass', async () => {
    const res = await startTestServer()
      .post('/api/auth/login')
      .send({ email: process.env.MASTER_ADMIN_EMAIL, password: process.env.MASTER_ADMIN_PASSWORD })
      .expect(200);
    expect(res.body?.tenant?.slug).toBe('MASTER');
    expect(res.body?.user?.role).toBe('PLATFORM_ADMIN');
    expect(res.body?.token).toBeTruthy();
  });

  test('auth.master.login.fail.wrong_password', async () => {
    await startTestServer()
      .post('/api/auth/login')
      .send({ email: process.env.MASTER_ADMIN_EMAIL, password: 'wrong-pass' })
      .expect(401);
  });
});

describe('Auth - tenant login', () => {
  test('auth.tenant.login.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const res = await startTestServer()
      .post('/api/auth/login')
      .set(tenantHeaders(slug))
      .send({ email: ownerEmail, password: ownerPass })
      .expect(200);
    expect(res.body?.tenant?.slug).toBe(slug);
  });

  test('auth.tenant.login.fail.no_header', async () => {
    const master = await loginMaster();
    const { ownerEmail, ownerPass } = await registerTenant(master.token);
    await startTestServer()
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: ownerPass })
      .expect(404); // tenant resolver returns not found without header
  });
});
