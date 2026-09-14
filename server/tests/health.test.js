const { startTestServer } = require('./helpers/testServer');

describe('Health endpoints', () => {
  test('health.app', async () => {
    await startTestServer().get('/api/health').expect(200);
  });
  test('health.db', async () => {
    await startTestServer().get('/api/health/db').expect(200);
  });
  test('health.redis', async () => {
    await startTestServer().get('/api/health/redis').expect(200);
  });
  test('health.storage', async () => {
    await startTestServer().get('/api/health/storage').expect(200);
  });
});
