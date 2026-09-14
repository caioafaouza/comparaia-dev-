const { startTestServer } = require('./helpers/testServer');
const { loginMaster } = require('./helpers/authUtils');

describe('Admin config & connectivity', () => {
  test('admin.config.pass', async () => {
    const master = await loginMaster();
    const res = await startTestServer()
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(res.body).toBeDefined();
  });

  test('admin.config.fail.no_admin', async () => {
    await startTestServer().get('/api/admin/config').expect(401);
  });

  test('admin.config.db.no_secret_leak', async () => {
    const master = await loginMaster();
    const res = await startTestServer()
      .get('/api/admin/config/db')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(res.body.pass).toBe('');
  });

  test('admin.test_connection.pass', async () => {
    const master = await loginMaster();
    await startTestServer()
      .post('/api/admin/test-connection')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ type: 'db' })
      .expect(200);
  });
});
