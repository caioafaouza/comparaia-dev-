const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant, loginTenant, tenantHeaders } = require('./helpers/authUtils');
const { getTenantBySlug, getTenantConnectionBySlug } = require('./helpers/dbUtils');

describe('Dashboard metrics', () => {
  test('dashboard.metrics.pass', async () => {
    const master = await loginMaster();
    const { slug, ownerEmail, ownerPass } = await registerTenant(master.token);
    const tenantRow = await getTenantBySlug(slug);
    const tenantDb = getTenantConnectionBySlug(tenantRow);

    // seed one job and one sale item to exercise metrics
    const prodInserted = await tenantDb('products')
      .insert({
        name: 'Produto Métrica',
        category: 'Tech',
        initial_cost: 50,
        stock_quantity: 5,
        min_stock: 1,
      })
      .returning('id');
    const productId = prodInserted[0].id || prodInserted[0];

    await tenantDb('comparison_jobs').insert({
      reference_name: 'Job Métrica',
      status: 'COMPLETED',
      candidate_count: 2,
      cost: 10,
    });

    const saleInserted = await tenantDb('sales').insert({ total_amount: 200, total_cost: 120 }).returning('id');
    const saleId = saleInserted[0].id || saleInserted[0];
    await tenantDb('sales_items').insert({
      sale_id: saleId,
      product_id: productId,
      quantity: 1,
      unit_price: 200,
      subtotal: 200,
    });

    const login = await loginTenant(slug, ownerEmail, ownerPass);
    const res = await startTestServer()
      .get('/api/dashboard/metrics')
      .set(tenantHeaders(slug, login.body.token))
      .expect(200);

    expect(res.body.totalJobs).toBeGreaterThanOrEqual(1);
    expect(Number(res.body.revenue)).toBeGreaterThanOrEqual(200);
    expect(Array.isArray(res.body.abcCurve)).toBe(true);
  });

  test('dashboard.metrics.fail.no_auth', async () => {
    await startTestServer().get('/api/dashboard/metrics').expect(404);
  });
});
