const { startTestServer } = require('./helpers/testServer');

describe('Security hardening', () => {
  test('security.cors.allowlist blocks unknown origin', async () => {
    const res = await startTestServer()
      .get('/api/health')
      .set('Origin', 'http://evil.test')
      .expect(500);
    expect(res.body.error).toBe('Internal server error');
  });

  test('security.no_stacktrace', async () => {
    const res = await startTestServer().get('/api/__test__/boom').expect(500);
    expect(res.body.error).toBe('Internal server error');
    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toMatch(/Boom!/i);
  });
});
