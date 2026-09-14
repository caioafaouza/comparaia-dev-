const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');
const { getTenantBySlug, getTenantConnectionBySlug } = require('./helpers/dbUtils');

describe('Products intelligence', () => {
  test('products.intelligence.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const tenantRow = await getTenantBySlug(slug);
    const tenantDb = getTenantConnectionBySlug(tenantRow);

    // seed one product + stock movement for meaningful metrics
    const inserted = await tenantDb('products')
      .insert({
        name: 'Produto Teste',
        category: 'Cat',
        initial_cost: 100,
        stock_quantity: 10,
        min_stock: 2,
      })
      .returning('id');
    const productId = inserted[0].id || inserted[0];

    await tenantDb('stock_movements').insert({
      product_id: productId,
      type: 'INPUT',
      quantity: 5,
      unit_cost: 120,
    });

    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const res = await startTestServer()
      .get(`/api/products/${productId}/intelligence`)
      .set(tenantHeaders(slug, login.body.token))
      .expect(200);

    expect(res.body.name).toBe('Produto Teste');
    expect(res.body.average_cost).toBeDefined();
    expect(res.body.suggested_price).toBeGreaterThan(0);
  });

  test('products.intelligence.fail.not_found', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const login = await loginTenant(slug, ownerEmail, ownerPass);

    await startTestServer()
      .get('/api/products/11111111-1111-1111-1111-111111111111/intelligence')
      .set(tenantHeaders(slug, login.body.token))
      .expect(404);
  });
});
