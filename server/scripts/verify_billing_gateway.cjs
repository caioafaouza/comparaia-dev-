const jwt = require('jsonwebtoken');
const config = require('../config/env');
const connectionManager = require('../db/connectionManager');

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

const main = async () => {
  const startedAt = Date.now();
  const apiBase = 'http://127.0.0.1:3000';
  const webhookTestKey = process.env.MP_WEBHOOK_TEST_KEY;

  const health = await fetchJson(`${apiBase}/api/health`);
  if (health.status !== 200) {
    console.error('[verify_billing_gateway] health failed', health);
    process.exit(1);
  }

  const db = connectionManager.getMaster();
  const hasOrders = await db.schema.hasTable('billing_orders');
  const hasEvents = await db.schema.hasTable('billing_events');
  if (!hasOrders || !hasEvents) {
    console.error('[verify_billing_gateway] billing schema missing. Run migrations.');
    process.exit(1);
  }

  const tenant = await db('tenants')
    .where({ status: 'ACTIVE' })
    .whereNot({ slug: 'MASTER' })
    .first();
  if (!tenant) {
    console.error('[verify_billing_gateway] no active tenant found');
    process.exit(1);
  }

  const link = await db('user_tenants').where({ tenant_id: tenant.id }).first();
  if (!link) {
    console.error('[verify_billing_gateway] no user_tenants link for tenant', tenant.id);
    process.exit(1);
  }

  const user = await db('users').where({ id: link.user_id }).first();
  if (!user) {
    console.error('[verify_billing_gateway] user not found for link', link.user_id);
    process.exit(1);
  }

  const pkg = await db('token_packages').where({ active: true }).first();
  if (!pkg) {
    console.error('[verify_billing_gateway] no active token package found');
    process.exit(1);
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: link.role || user.role || 'OWNER',
      tenantId: tenant.id,
    },
    config.security.jwtSecret,
    { expiresIn: '1h' },
  );

  const idempotencyKey = `verify-${tenant.id}-${pkg.id}-${Date.now()}`;
  const purchase = await fetchJson(`${apiBase}/api/billing/purchase-package`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenant.slug || tenant.id,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ packageId: pkg.id }),
  });

  if (purchase.status !== 200 || !purchase.body?.orderId) {
    console.error('[verify_billing_gateway] purchase failed', purchase);
    process.exit(1);
  }

  const orderId = purchase.body.orderId;

  const initialOrder = await fetchJson(`${apiBase}/api/billing/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': tenant.slug || tenant.id,
    },
  });

  if (initialOrder.status !== 200) {
    console.error('[verify_billing_gateway] initial order read failed', initialOrder);
    process.exit(1);
  }

  if (!webhookTestKey) {
    console.error('[verify_billing_gateway] MP_WEBHOOK_TEST_KEY missing; cannot simulate webhook.');
    process.exit(1);
  }

  const paymentId = `sim-${Date.now()}`;
  const webhookPending = await fetchJson(`${apiBase}/api/billing/webhook/mercadopago`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mp-simulate': webhookTestKey,
    },
    body: JSON.stringify({
      type: 'payment',
      data: { id: paymentId },
      payment: {
        id: paymentId,
        status: 'pending',
        external_reference: orderId,
        metadata: { orderId, tenantId: tenant.id, type: 'PACKAGE', itemId: pkg.id },
      },
    }),
  });

  if (webhookPending.status !== 200) {
    console.error('[verify_billing_gateway] pending webhook failed', webhookPending);
    process.exit(1);
  }

  const webhookApproved = await fetchJson(`${apiBase}/api/billing/webhook/mercadopago`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mp-simulate': webhookTestKey,
    },
    body: JSON.stringify({
      type: 'payment',
      data: { id: paymentId },
      payment: {
        id: paymentId,
        status: 'approved',
        external_reference: orderId,
        metadata: { orderId, tenantId: tenant.id, type: 'PACKAGE', itemId: pkg.id },
      },
    }),
  });

  if (webhookApproved.status !== 200) {
    console.error('[verify_billing_gateway] approved webhook failed', webhookApproved);
    process.exit(1);
  }

  const syncedOrder = await fetchJson(`${apiBase}/api/billing/orders/${orderId}?sync=1`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': tenant.slug || tenant.id,
    },
  });

  if (syncedOrder.status !== 200) {
    console.error('[verify_billing_gateway] synced order read failed', syncedOrder);
    process.exit(1);
  }

  const updatedOrder = await db('billing_orders').where({ id: orderId }).first();
  if (!updatedOrder || updatedOrder.status !== 'PAID') {
    console.error('[verify_billing_gateway] order not paid', updatedOrder);
    process.exit(1);
  }

  const txRows = await db('token_transactions').where({ reference_id: orderId, type: 'TOKEN_PACKAGE' });
  if (!txRows.length) {
    console.error('[verify_billing_gateway] token transaction not found');
    process.exit(1);
  }
  if (txRows.length !== 1) {
    console.error('[verify_billing_gateway] idempotency failed, expected exactly 1 token credit', {
      found: txRows.length,
    });
    process.exit(1);
  }

  const durationMs = Date.now() - startedAt;
  console.log('[verify_billing_gateway] OK', {
    tenantId: tenant.id,
    orderId,
    paymentId,
    durationMs,
  });
  process.exit(0);
};

main().catch((err) => {
  console.error('[verify_billing_gateway] error', err);
  process.exit(1);
});
