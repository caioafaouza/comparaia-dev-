const { startTestServer } = require('./helpers/testServer');
const { loginMaster } = require('./helpers/authUtils');

describe('Admin users listing', () => {
  test('users.master.list.pass', async () => {
    const master = await loginMaster();
    const res = await startTestServer()
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('users.master.list.fail.no_admin', async () => {
    await startTestServer().get('/api/admin/users').expect(401);
  });
});
