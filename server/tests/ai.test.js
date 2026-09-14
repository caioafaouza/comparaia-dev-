jest.mock('../services/aiFactory', () => ({
  getAIClient: async () => ({
    provider: 'MockAI',
    generateJSON: async () => ({
      referenceName: 'Ref',
      executiveSummary: 'ok',
      candidates: [{ productName: 'Cand', totalScore: 1, attributes: [] }],
    }),
    generateContent: async () => 'ok',
  }),
}));

const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, tenantHeaders, loginTenant } = require('./helpers/authUtils');

describe('AI endpoints - analyze-raw', () => {
  test('ai.analyze_raw.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const token = login.body.token;

    const res = await startTestServer()
      .post('/api/ai/analyze-raw')
      .set(tenantHeaders(slug, token))
      .send({
        reference: { content: 'ref text' },
        candidates: [{ name: 'cand1', mimeType: 'text/plain', data: 'Y2FuZA==' }],
      })
      .expect(200);

    expect(res.body.candidates?.length).toBeGreaterThan(0);
  });

  test('ai.analyze_raw.fail.no_token', async () => {
    const master = await loginMaster();
    const { slug } = await registerTenant(master.token);
    await startTestServer()
      .post('/api/ai/analyze-raw')
      .set({ 'X-Tenant-ID': slug })
      .send({ reference: { content: 'ref' }, candidates: [] })
      .expect(401);
  });

  test('ai.analyze_raw.fail.no_tenant_header', async () => {
    const master = await loginMaster();
    const { ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant('missing', ownerEmail, ownerPass);
    // Expected 404 because tenantResolver won't resolve without header
    expect(login.status).toBe(404);
  });
});
