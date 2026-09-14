jest.mock('../services/aiFactory', () => ({
  getAIClient: async () => ({
    generateContent: async () => 'Compra recomendada',
    generateJSON: async () => ({}),
  }),
}));

const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');
const { getTenantBySlug, getTenantConnectionBySlug } = require('./helpers/dbUtils');

describe('AI shopping assistant', () => {
  test('ai.shopping.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const tenantRow = await getTenantBySlug(slug);
    const tenantDb = getTenantConnectionBySlug(tenantRow);

    await tenantDb('products').insert({
      name: 'Critico',
      category: 'Cat',
      stock_quantity: 0,
      min_stock: 1,
      initial_cost: 50,
    });

    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const res = await startTestServer()
      .post('/api/ai/shopping-assistant')
      .set(tenantHeaders(slug, login.body.token))
      .send({})
      .expect(200);
    expect(res.body.analysis).toBeDefined();
  });

  test('ai.shopping.fail.no_auth', async () => {
    // Sem token e sem tenant header retorna 404 pelo tenantResolver/requireTenant
    await startTestServer().post('/api/ai/shopping-assistant').send({}).expect(404);
  });
});
