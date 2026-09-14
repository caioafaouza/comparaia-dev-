const path = require('path');
const supertest = require('supertest');
const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');

describe('Jobs', () => {
  test('jobs.create.multipart.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const token = login.body.token;
    const userId = login.body.user.id;

    const api = startTestServer();
    const res = await api
      .post('/api/jobs')
      .set(tenantHeaders(slug, token))
      .field('userId', userId)
      .attach('referenceFile', path.join(__dirname, 'fixtures', 'sample.txt'))
      .attach('candidateFiles', path.join(__dirname, 'fixtures', 'sample.txt'))
      .expect(200);

    expect(res.body.id).toBeTruthy();
  });

  test('jobs.create.fail.no_token', async () => {
    const master = await loginMaster();
    const { slug } = await registerTenant(master.token, { slug: `tn-${Date.now()}` });
    await startTestServer()
      .post('/api/jobs')
      .set({ 'X-Tenant-ID': slug })
      .field('userId', 'dummy')
      .expect(401);
  });

  test('jobs.list.fail.cross_tenant', async () => {
    const master = await loginMaster();
    const { slug: slugA, ownerEmail, ownerPass } = await registerTenant(master.token, { slug: `ta-${Date.now()}` });
    const loginA = await loginTenant(slugA, ownerEmail, ownerPass);

    const { slug: slugB } = await registerTenant(master.token, { slug: `tb-${Date.now()}` });

    // token from tenant A with header of tenant B -> should 403/404
    await startTestServer()
      .get('/api/jobs')
      .set(tenantHeaders(slugB, loginA.body.token))
      .expect(res => {
        const status = res.status;
        if (![403, 404].includes(status)) {
          throw new Error(`Expected 403/404, got ${status}`);
        }
      });
  });
});
