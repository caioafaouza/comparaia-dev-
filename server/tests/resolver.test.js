const { startTestServer } = require('./helpers/testServer');
const { loginMaster } = require('./helpers/authUtils');

describe('Tenant resolver - header', () => {
  test('tenant.resolver.header.fail.unknown', async () => {
    await startTestServer()
      .get('/api/jobs')
      .set('X-Tenant-ID', 'slug-inexistente')
      .expect(404);
  });
});

describe('Tenant resolver - admin routes always master', () => {
  test('tenant.resolver.admin_routes.master_context', async () => {
    const master = await loginMaster();
    await startTestServer()
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
  });
});
