const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant } = require('./helpers/authUtils');

describe('Admin tenants', () => {
  test('admin.tenants.list.pass', async () => {
    const master = await loginMaster();
    const res = await startTestServer()
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('admin.tenants.list.fail.no_token', async () => {
    await startTestServer().get('/api/admin/tenants').expect(401);
  });
});

describe('Tenant register', () => {
  test('tenant.register.pass', async () => {
    const master = await loginMaster();
    const { response } = await registerTenant(master.token);
    expect([200, 201]).toContain(response.status);
    expect(response.body.slug).toBeTruthy();
    expect(response.body.tenantId).toBeTruthy();
  });

  test('tenant.register.fail.duplicate_slug', async () => {
    const master = await loginMaster();
    const { slug } = await registerTenant(master.token);
    const second = await registerTenant(master.token, { slug });
    expect(second.response.status).toBeGreaterThanOrEqual(400);
  });
});
