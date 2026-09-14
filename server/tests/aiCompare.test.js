jest.mock('../services/aiFactory', () => ({
  getAIClient: async () => ({
    generateJSON: async () => ({
      referenceName: 'Ref',
      candidates: [
        { productName: 'A', totalScore: 0.9, attributes: [] },
        { productName: 'B', totalScore: 0.7, attributes: [] },
      ],
    }),
    generateContent: async () => 'ok',
  }),
}));

const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');
const { getTenantBySlug, getTenantConnectionBySlug } = require('./helpers/dbUtils');

describe('AI compare endpoint', () => {
  test('ai.compare.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const tenantRow = await getTenantBySlug(slug);
    const tenantDb = getTenantConnectionBySlug(tenantRow);

    const prodIds = await tenantDb('products')
      .insert([
        { name: 'ProdA', category: 'Cat', initial_cost: 10, stock_quantity: 1, min_stock: 0 },
        { name: 'ProdB', category: 'Cat', initial_cost: 12, stock_quantity: 1, min_stock: 0 },
      ])
      .returning('id');
    const ids = prodIds.map((p) => p.id || p);

    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const res = await startTestServer()
      .post('/api/ai/compare')
      .set(tenantHeaders(slug, login.body.token))
      .send({ productIds: ids })
      .expect(200);
    expect(res.body.candidates?.length).toBe(2);
  });

  test('ai.compare.fail.no_auth', async () => {
    // Sem token e sem header de tenant → tenant resolver responde 404
    await startTestServer().post('/api/ai/compare').send({ productIds: [] }).expect(404);
  });

  test('ai.compare.fail.no_tenant', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant(slug, ownerEmail, ownerPass);
    await startTestServer()
      .post('/api/ai/compare')
      .set({ Authorization: `Bearer ${login.body.token}` })
      .send({ productIds: [] })
      .expect(404);
  });
});
