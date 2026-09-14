const { v4: uuidv4 } = require('uuid');
const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');
const mercadoPagoService = require('../services/mercadoPagoService');
const { logAudit } = require('../services/auditService');
const { sendTransactionalEmail, getTenantAdminRecipients } = require('../services/transactionalEmailService');

const DEFAULT_PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 0,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 100, maxUsers: 2, maxCandidatesPerJob: 3, maxStorageGB: 1, maxFileSizeMB: 10 },
    features: { auditLog: false, whiteLabel: false, apiAccess: false, customDomain: false, sso: false },
  },
  {
    id: 'PRO',
    name: 'Pro Team',
    price: 499,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 5000, maxUsers: 10, maxCandidatesPerJob: 15, maxStorageGB: 50, maxFileSizeMB: 50 },
    features: { auditLog: true, whiteLabel: true, apiAccess: true, customDomain: true, sso: false },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 2900,
    currency: 'BRL',
    active: true,
    limits: { monthlyTokens: 99999, maxUsers: 100, maxCandidatesPerJob: 50, maxStorageGB: 500, maxFileSizeMB: 200 },
    features: { auditLog: true, whiteLabel: true, apiAccess: true, customDomain: true, sso: true, prioritySupport: true },
  },
];

const DEFAULT_PACKAGES = [
  { id: 'pkg_basic', name: 'Pacote Basic', tokens: 1000, price: 49, active: true },
  { id: 'pkg_pro', name: 'Pacote Pro', tokens: 5000, price: 199, active: true },
];

const ORDER_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

const buildIdempotencyKey = (req, type, itemId) => {
  const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (headerKey) return String(headerKey);
  const tenantId = req.tenant?.id || 'MASTER';
  const userId = req.user?.userId || req.user?.id || 'unknown';
  const now = Date.now();
  return `${tenantId}:${userId}:${type}:${itemId}:${now}`;
};

const resolveUrls = (req) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const backend = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const frontend = process.env.FRONTEND_URL || origin;
  return { backend, frontend };
};

const resolveBillingReturnPath = (req) => {
  const customPath = req.body?.returnPath || req.query?.returnPath;
  if (typeof customPath === 'string' && customPath.startsWith('/')) {
    return customPath;
  }
  return req.user?.role === 'PLATFORM_ADMIN' ? '/admin/billing' : '/billing';
};

const buildBackUrls = (frontend, req, orderId) => {
  const basePath = resolveBillingReturnPath(req);
  const build = (status) => {
    const url = new URL(basePath, frontend);
    url.searchParams.set('status', status);
    if (orderId) url.searchParams.set('orderId', orderId);
    return url.toString();
  };
  return {
    success: build('success'),
    failure: build('failure'),
    pending: build('pending'),
  };
};

const mapPaymentStatus = (status) => {
  if (status === 'approved') return ORDER_STATUS.PAID;
  if (status === 'pending' || status === 'in_process' || status === 'in_review') return ORDER_STATUS.PENDING;
  if (status === 'rejected' || status === 'cancelled' || status === 'charged_back') return ORDER_STATUS.FAILED;
  return ORDER_STATUS.PENDING;
};

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
};

const notifyOrderStatusByEmail = async (trx, order, payment, newStatus) => {
  try {
    if (!order?.tenant_id) return;
    if (newStatus !== ORDER_STATUS.PAID && newStatus !== ORDER_STATUS.FAILED) return;

    const recipients = await getTenantAdminRecipients(order.tenant_id, trx);
    if (!recipients.length) return;

    const tenant = await trx('tenants').where({ id: order.tenant_id }).first();
    const templateKey = newStatus === ORDER_STATUS.PAID ? 'payment_approved' : 'payment_failed';
    const reason = payment?.status_detail || payment?.status || 'Falha de pagamento';

    await sendTransactionalEmail({
      templateKey,
      to: recipients,
      db: trx,
      variables: {
        orderId: order.id,
        amount: Number(order.amount || 0).toFixed(2),
        gatewayName: order.provider || 'Gateway',
        tenantName: tenant?.name || order.tenant_id,
        reason,
      },
    });
  } catch {
    // Non-blocking notification flow
  }
};

const applyOrderPayment = async (trx, order, payment) => {
  if (!order || !payment) return order;
  const paymentStatus = payment?.status || 'pending';
  const newStatus = mapPaymentStatus(paymentStatus);
  const paymentId = payment?.id ? String(payment.id) : (order.payment_id || null);

  if (
    order.status === ORDER_STATUS.PAID &&
    newStatus === ORDER_STATUS.PAID &&
    order.payment_id === paymentId
  ) {
    return order;
  }

  await trx('billing_orders')
    .where({ id: order.id })
    .update({
      status: newStatus,
      payment_id: paymentId,
      updated_at: new Date(),
    });

  if (newStatus === ORDER_STATUS.PAID && order.order_type === 'PACKAGE') {
    const alreadyCredited = await trx('token_transactions')
      .where({ reference_id: order.id, type: 'TOKEN_PACKAGE' })
      .first();

    if (!alreadyCredited) {
      const pkg = await trx('token_packages').where({ id: order.item_id }).first();
      if (pkg) {
        await billingService.creditTokens(
          order.tenant_id,
          pkg.tokens,
          {
            type: 'TOKEN_PACKAGE',
            description: `MercadoPago Payment ${paymentId || order.id}`,
            referenceId: order.id,
          },
          trx,
        );

        const recipients = await getTenantAdminRecipients(order.tenant_id, trx);
        if (recipients.length > 0) {
          const wallet = await trx('wallet').where({ tenant_id: order.tenant_id }).first();
          const tenant = await trx('tenants').where({ id: order.tenant_id }).first();
          await sendTransactionalEmail({
            templateKey: 'credit_confirmation',
            to: recipients,
            db: trx,
            variables: {
              userName: 'Cliente',
              tenantName: tenant?.name || order.tenant_id,
              amount: Number(pkg.tokens || 0),
              balance: Number(wallet?.balance || 0),
              transactionId: order.id,
            },
          });
        }
      }
    }
  }

  if (newStatus === ORDER_STATUS.PAID && order.order_type === 'PLAN') {
    await trx('tenants')
      .where({ id: order.tenant_id })
      .update({ plan: order.item_id, updated_at: new Date() });
  }

  if (newStatus !== order.status) {
    await notifyOrderStatusByEmail(trx, order, payment, newStatus);
  }

  return { ...order, status: newStatus, payment_id: paymentId };
};

const mapPlan = (row) => ({
  id: row.id,
  name: row.name,
  price: billingService.toNumber(row.price, 0),
  currency: row.currency || 'BRL',
  active: row.active !== false,
  limits: billingService.safeJsonParse(row.limits, {}),
  features: billingService.safeJsonParse(row.features, {}),
});

const mapPackage = (row) => ({
  id: row.id,
  name: row.name,
  tokens: billingService.toNumber(row.tokens, 0),
  price: billingService.toNumber(row.price, 0),
  active: row.active !== false,
});

const seedDefaultPlans = async (db) => {
  const rows = await db('token_plans').select('id').limit(1);
  if (rows.length > 0) return;
  await db('token_plans').insert(
    DEFAULT_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency || 'BRL',
      active: plan.active !== false,
      limits: JSON.stringify(plan.limits || {}),
      features: JSON.stringify(plan.features || {}),
    })),
  );
};

const seedDefaultPackages = async (db) => {
  const rows = await db('token_packages').select('id').limit(1);
  if (rows.length > 0) return;
  await db('token_packages').insert(
    DEFAULT_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      tokens: pkg.tokens,
      price: pkg.price,
      active: pkg.active !== false,
    })),
  );
};

const getPlans = async (_req, res) => {
  try {
    const db = connectionManager.getMaster();
    await seedDefaultPlans(db);
    const rows = await db('token_plans').where({ active: true }).orderBy('price', 'asc');
    return res.json(rows.map(mapPlan));
  } catch (error) {
    console.error('Get plans error:', error);
    return res.status(500).json({ error: 'Erro ao listar planos.' });
  }
};

const getTokenPackages = async (_req, res) => {
  try {
    const db = connectionManager.getMaster();
    await seedDefaultPackages(db);
    const rows = await db('token_packages').where({ active: true }).orderBy('price', 'asc');
    return res.json(rows.map(mapPackage));
  } catch (error) {
    console.error('Get token packages error:', error);
    return res.status(500).json({ error: 'Erro ao listar pacotes.' });
  }
};

const getPaymentGateways = async (_req, res) => {
  try {
    const db = connectionManager.getMaster();
    const rows = await db('payment_gateways').select('*').orderBy('name', 'asc');
    const gateways = rows.map((row) => {
      const creds = billingService.safeJsonParse(row.credentials, {});
      return {
        provider: row.provider,
        name: row.name,
        active: row.active !== false,
        isDefault: row.is_default === true,
        credentials: {
          publicKey: creds.publicKey || '',
        },
        customInstructions: row.custom_instructions || '',
      };
    });
    return res.json(gateways);
  } catch (error) {
    console.error('Get payment gateways error:', error);
    return res.status(500).json({ error: 'Erro ao listar gateways.' });
  }
};

const getWallet = async (req, res) => {
  try {
    const tenant = req.tenant;
    const wallet = await billingService.getTenantWalletBalance(tenant);
    return res.json({
      tenantId: tenant?.id,
      balance: wallet.balance,
      planTokens: wallet.planTokens,
      addedTokens: wallet.addedTokens,
      consumedTokens: wallet.consumedTokens,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ error: 'Erro ao carregar saldo.' });
  }
};

const getTransactions = async (req, res) => {
  try {
    const db = connectionManager.getMaster();
    const rows = await db('token_transactions')
      .where({ tenant_id: req.tenant.id })
      .orderBy('created_at', 'desc');
    const result = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      amount: billingService.toNumber(row.amount, 0),
      description: row.description || '',
      date: row.created_at,
      type: row.type || 'TOKEN_REFILL',
    }));
    return res.json(result);
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ error: 'Erro ao listar transações.' });
  }
};

const upgradePlan = async (req, res) => {
  try {
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'Plano obrigatório.' });

    const db = connectionManager.getMaster();
    const plan = await db('token_plans').where({ id: planId }).first();
    if (!plan || plan.active === false) {
      return res.status(404).json({ error: 'Plano não encontrado.' });
    }

    // Free plan? Instant upgrade
    if (Number(plan.price) === 0) {
      await db('tenants').where({ id: req.tenant.id }).update({ plan: planId, updated_at: new Date() });
      await logAudit(req, 'PLAN_UPGRADE', 'billing', `plan=${planId};type=free`);
      return res.json({ success: true, message: 'Plano atualizado.' });
    }

    if (!(await db.schema.hasTable('billing_orders'))) {
      return res.status(500).json({ error: 'BILLING_SCHEMA_MISSING' });
    }

    const idempotencyKey = buildIdempotencyKey(req, 'PLAN', plan.id);
    const existingOrder = await db('billing_orders').where({ idempotency_key: idempotencyKey }).first();
    if (existingOrder) {
      if (existingOrder.status === ORDER_STATUS.PAID) {
        return res.json({ success: true, alreadyPaid: true, orderId: existingOrder.id });
      }
      if (existingOrder.init_point) {
        return res.json({
          success: true,
          initPoint: existingOrder.init_point,
          sandboxInitPoint: existingOrder.sandbox_init_point,
          orderId: existingOrder.id,
        });
      }
    }

    const orderId = uuidv4();
    const { backend, frontend } = resolveUrls(req);
    const userId = req.user?.userId || req.user?.id;

    await db('billing_orders').insert({
      id: orderId,
      tenant_id: req.tenant.id,
      user_id: userId,
      order_type: 'PLAN',
      item_id: plan.id,
      amount: billingService.toNumber(plan.price, 0),
      currency: plan.currency || 'BRL',
      status: ORDER_STATUS.CREATED,
      provider: 'MERCADO_PAGO',
      idempotency_key: idempotencyKey,
      external_reference: orderId,
      metadata: {
        tenantId: req.tenant.id,
        type: 'PLAN',
        itemId: plan.id,
        orderId,
      },
      created_at: new Date(),
      updated_at: new Date(),
    });

    try {
      const preference = await mercadoPagoService.createPreference(
        [{
          id: plan.id,
          title: `Assinatura: ${plan.name}`,
          quantity: 1,
          unit_price: Number(plan.price),
        }],
        {
          email: req.user.email,
          name: req.user.name,
        },
        {
          externalReference: orderId,
          metadata: { tenantId: req.tenant.id, type: 'PLAN', itemId: plan.id, orderId },
          backUrls: buildBackUrls(frontend, req, orderId),
          notificationUrl: `${backend}/api/billing/webhook/mercadopago`,
          idempotencyKey,
        },
        { idempotencyKey }
      );

      await db('billing_orders')
        .where({ id: orderId })
        .update({
          status: ORDER_STATUS.PENDING,
          preference_id: preference.id || null,
          init_point: preference.init_point || null,
          sandbox_init_point: preference.sandbox_init_point || null,
          updated_at: new Date(),
        });

      return res.json({
        success: true,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
        orderId,
      });
    } catch (mpError) {
      await db('billing_orders')
        .where({ id: orderId })
        .update({ status: ORDER_STATUS.FAILED, updated_at: new Date() });

      return res.status(502).json({
        error: 'Erro ao comunicar com gateway de pagamento.',
        details: 'BILLING_GATEWAY_UNAVAILABLE',
      });
    }

  } catch (error) {
    console.error('Upgrade plan error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar plano.' });
  }
};

const purchasePackage = async (req, res) => {
  try {
    const { packageId, packageSlug } = req.body || {};
    const resolvedPackageId = packageId || packageSlug;
    if (!resolvedPackageId) return res.status(400).json({ error: 'Pacote obrigatório.' });

    const db = connectionManager.getMaster();
    const pkg = await db('token_packages').where({ id: resolvedPackageId }).first();
    if (!pkg || pkg.active === false) return res.status(404).json({ error: 'Pacote não encontrado.' });

    if (!(await db.schema.hasTable('billing_orders'))) {
      return res.status(500).json({ error: 'BILLING_SCHEMA_MISSING' });
    }

    const idempotencyKey = buildIdempotencyKey(req, 'PACKAGE', pkg.id);
    const existingOrder = await db('billing_orders').where({ idempotency_key: idempotencyKey }).first();
    if (existingOrder) {
      if (existingOrder.status === ORDER_STATUS.PAID) {
        return res.json({ success: true, alreadyPaid: true, orderId: existingOrder.id });
      }
      if (existingOrder.init_point) {
        return res.json({
          success: true,
          initPoint: existingOrder.init_point,
          sandboxInitPoint: existingOrder.sandbox_init_point,
          orderId: existingOrder.id,
        });
      }
    }

    const orderId = uuidv4();
    const { backend, frontend } = resolveUrls(req);
    const userId = req.user?.userId || req.user?.id;

    await db('billing_orders').insert({
      id: orderId,
      tenant_id: req.tenant.id,
      user_id: userId,
      order_type: 'PACKAGE',
      item_id: pkg.id,
      amount: billingService.toNumber(pkg.price, 0),
      currency: pkg.currency || 'BRL',
      status: ORDER_STATUS.CREATED,
      provider: 'MERCADO_PAGO',
      idempotency_key: idempotencyKey,
      external_reference: orderId,
      metadata: {
        tenantId: req.tenant.id,
        type: 'PACKAGE',
        itemId: pkg.id,
        orderId,
      },
      created_at: new Date(),
      updated_at: new Date(),
    });

    try {
      const preference = await mercadoPagoService.createPreference(
        [{
          id: pkg.id,
          title: pkg.name,
          quantity: 1,
          unit_price: Number(pkg.price),
        }],
        {
          email: req.user.email,
          name: req.user.name,
        },
        {
          externalReference: orderId,
          metadata: { tenantId: req.tenant.id, type: 'PACKAGE', itemId: pkg.id, orderId },
          backUrls: buildBackUrls(frontend, req, orderId),
          notificationUrl: `${backend}/api/billing/webhook/mercadopago`,
          idempotencyKey,
        },
        { idempotencyKey }
      );

      await db('billing_orders')
        .where({ id: orderId })
        .update({
          status: ORDER_STATUS.PENDING,
          preference_id: preference.id || null,
          init_point: preference.init_point || null,
          sandbox_init_point: preference.sandbox_init_point || null,
          updated_at: new Date(),
        });

      return res.json({
        success: true,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
        orderId,
      });

    } catch (mpError) {
      await db('billing_orders')
        .where({ id: orderId })
        .update({ status: ORDER_STATUS.FAILED, updated_at: new Date() });
      console.error('MP Preference Error:', mpError);
      return res.status(502).json({ 
        error: 'Erro ao comunicar com gateway de pagamento.', 
        mpError: mpError.stack || mpError.message || String(mpError) 
      });
    }

  } catch (error) {
    console.error('Purchase package error:', error);
    return res.status(500).json({ error: 'Erro ao iniciar compra.' });
  }
};

const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId é obrigatório.' });
    }

    const db = connectionManager.getMaster();
    const order = await db('billing_orders')
      .where({ id: orderId, tenant_id: req.tenant.id })
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    let currentOrder = order;
    const shouldSync = normalizeBoolean(req.query?.sync);
    const isNotFinal =
      order.status !== ORDER_STATUS.PAID &&
      order.status !== ORDER_STATUS.FAILED &&
      order.status !== ORDER_STATUS.CANCELLED;

    if (shouldSync && isNotFinal) {
      const paymentList = await mercadoPagoService.searchPaymentsByExternalReference(order.external_reference || order.id, {
        idempotencyKey: `order-sync:${order.id}`,
      });

      if (Array.isArray(paymentList) && paymentList.length > 0) {
        const payment = paymentList[0];
        currentOrder = await db.transaction(async (trx) => applyOrderPayment(trx, order, payment));
      }
    }

    return res.json({
      id: currentOrder.id,
      tenantId: currentOrder.tenant_id,
      status: currentOrder.status,
      orderType: currentOrder.order_type,
      itemId: currentOrder.item_id,
      amount: billingService.toNumber(currentOrder.amount, 0),
      currency: currentOrder.currency || 'BRL',
      paymentId: currentOrder.payment_id || null,
      initPoint: currentOrder.init_point || null,
      sandboxInitPoint: currentOrder.sandbox_init_point || null,
      updatedAt: currentOrder.updated_at,
    });
  } catch (error) {
    console.error('Get order status error:', error);
    return res.status(500).json({ error: 'Erro ao consultar status do pedido.' });
  }
};

const recordPaymentFailure = async (req, res) => {
  try {
    const { amount, reason } = req.body || {};
    const db = connectionManager.getMaster();
    const normalizedAmount = billingService.toNumber(amount, 0);
    const normalizedReason = reason || 'Falha nao especificada';
    await db('billing_failures').insert({
      id: uuidv4(),
      tenant_id: req.tenant.id,
      amount: normalizedAmount,
      reason: normalizedReason,
      created_at: new Date(),
    });

    const recipients = await getTenantAdminRecipients(req.tenant.id, db);
    if (recipients.length > 0) {
      await sendTransactionalEmail({
        templateKey: 'payment_failed',
        to: recipients,
        db,
        variables: {
          orderId: 'N/A',
          reason: normalizedReason,
          amount: normalizedAmount.toFixed(2),
          tenantName: req.tenant?.name || req.tenant?.id || 'Tenant',
        },
      });
    }

    await logAudit(req, 'PAYMENT_FAILED', 'billing', reason || '');
    return res.json({ success: true });
  } catch (error) {
    console.error('Payment failure error:', error);
    return res.status(500).json({ error: 'Erro ao registrar falha.' });
  }
};

const normalizeWebhookType = (rawType) => String(rawType || '').toLowerCase().trim();
const isPaymentType = (type) => type === 'payment' || type.startsWith('payment.');
const isMerchantOrderType = (type) => type === 'merchant_order' || type.startsWith('merchant_order.');

const resolveWebhookResourceId = (body, query) => {
  const id =
    body?.data?.id ||
    body?.payment?.id ||
    body?.merchant_order?.id ||
    query['data.id'] ||
    query.id;
  return id ? String(id) : '';
};

const resolveWebhookEventId = (body, type, resourceId) => {
  if (body?.id) return String(body.id);
  if (body?.action_id) return String(body.action_id);
  if (resourceId) return `${type}:${resourceId}`;
  return `${type}:unknown`;
};

const isMercadoPagoNotFound = (error) => {
  const statusCode = Number(
    error?.status ||
    error?.cause?.status ||
    error?.response?.status,
  );
  return (
    statusCode === 404 ||
    /not\s*found|resource\s*not\s*found|404/i.test(String(error?.message || ''))
  );
};

const handleWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const type = normalizeWebhookType(body.type || query.type || query.topic || body.action);
    const resourceId = resolveWebhookResourceId(body, query);
    const paymentNotification = isPaymentType(type);
    const merchantOrderNotification = isMerchantOrderType(type);

    if (!paymentNotification && !merchantOrderNotification) {
      return res.status(200).send('OK');
    }

    const db = connectionManager.getMaster();
    const provider = 'MERCADO_PAGO';
    const hasEvents = await db.schema.hasTable('billing_events');
    const hasOrders = await db.schema.hasTable('billing_orders');
    const eventId = resolveWebhookEventId(body, type, resourceId);

    // --- SIGNATURE VALIDATION ---
    const crypto = require('crypto');
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    let signatureValid = true;
    const isIpnRequest = !!query.topic || !!query.id || !!query['data.id'];

    if (process.env.MP_WEBHOOK_SECRET && !isIpnRequest) {
      if (!xSignature || !xRequestId) {
        console.warn('Webhook Msg: Missing signature headers. Ignoring.');
        return res.status(401).send('Unauthorized');
      }

      const parts = String(xSignature).split(';');
      const tsPart = parts.find((p) => p.startsWith('ts='));
      const v1Part = parts.find((p) => p.startsWith('v1='));

      if (!tsPart || !v1Part) {
        console.warn('Webhook Msg: Invalid signature format.');
        return res.status(401).send('Unauthorized');
      }

      const ts = tsPart.split('=')[1];
      const hash = v1Part.split('=')[1];
      const manifestId = resourceId || '';
      const template = `id:${manifestId};request-id:${xRequestId};ts:${ts};`;

      const computedHash = crypto
        .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
        .update(template)
        .digest('hex');

      signatureValid = computedHash === hash;
      if (!signatureValid) {
        console.warn('Webhook Msg: Signature mismatch.');
        return res.status(401).send('Unauthorized');
      }
    }

    // --- EVENT UPSERT ---
    if (hasEvents) {
      const exists = await db('billing_events').where({ provider, event_id: eventId }).first();
      if (!exists) {
        await db('billing_events').insert({
          id: uuidv4(),
          provider,
          event_id: eventId,
          event_type: type,
          resource_id: resourceId || null,
          payload: req.body || {},
          signature_valid: signatureValid,
          status: 'RECEIVED',
          received_at: new Date(),
        });
      } else {
        await db('billing_events')
          .where({ provider, event_id: eventId })
          .update({
            event_type: type,
            resource_id: resourceId || null,
            payload: req.body || {},
            signature_valid: signatureValid,
            status: 'RECEIVED',
            received_at: new Date(),
            processed_at: null,
          });
      }
    }

    const simulateKey = req.headers['x-mp-simulate'];
    const isSimulation =
      !!simulateKey && !!process.env.MP_WEBHOOK_TEST_KEY && simulateKey === process.env.MP_WEBHOOK_TEST_KEY;

    const paymentIds = new Set();
    const simulatedPaymentsById = new Map();

    if (paymentNotification) {
      if (resourceId) paymentIds.add(resourceId);
      if (body?.payment?.id) {
        simulatedPaymentsById.set(String(body.payment.id), body.payment);
      }
    }

    if (merchantOrderNotification) {
      const merchantOrderId = resourceId;
      if (!merchantOrderId) {
        if (hasEvents) {
          await db('billing_events')
            .where({ provider, event_id: eventId })
            .update({ status: 'PROCESSED', processed_at: new Date() });
        }
        return res.status(200).send('OK');
      }

      try {
        const merchantOrder = await mercadoPagoService.getMerchantOrder(merchantOrderId, {
          idempotencyKey: `merchant-order:${merchantOrderId}`,
        });
        const merchantPayments = Array.isArray(merchantOrder?.payments) ? merchantOrder.payments : [];
        merchantPayments.forEach((entry) => {
          if (entry?.id) paymentIds.add(String(entry.id));
        });
      } catch (mpError) {
        if (isMercadoPagoNotFound(mpError)) {
          if (hasEvents) {
            await db('billing_events')
              .where({ provider, event_id: eventId })
              .update({ status: 'PROCESSED', processed_at: new Date() });
          }
          return res.status(200).send('OK');
        }
        throw mpError;
      }
    }

    if (!paymentIds.size) {
      if (hasEvents) {
        await db('billing_events')
          .where({ provider, event_id: eventId })
          .update({ status: 'PROCESSED', processed_at: new Date() });
      }
      return res.status(200).send('OK');
    }

    for (const paymentId of paymentIds) {
      let payment = null;

      if (isSimulation && simulatedPaymentsById.has(String(paymentId))) {
        payment = simulatedPaymentsById.get(String(paymentId));
      } else {
        try {
          payment = await mercadoPagoService.getPayment(paymentId, { idempotencyKey: String(paymentId) });
        } catch (mpError) {
          if (isMercadoPagoNotFound(mpError)) {
            continue;
          }
          throw mpError;
        }
      }

      if (!payment) continue;

      const paymentStatus = payment?.status || 'pending';
      const externalReference = payment?.external_reference;
      const metadata = payment?.metadata || {};

      let order = null;
      if (hasOrders) {
        if (externalReference) {
          order = await db('billing_orders')
            .where({ id: String(externalReference) })
            .orWhere({ external_reference: String(externalReference) })
            .first();
        }
        if (!order && metadata?.orderId) {
          order = await db('billing_orders')
            .where({ id: String(metadata.orderId) })
            .first();
        }
      }

      let legacyContext = null;
      if (!order && externalReference) {
        try {
          legacyContext = JSON.parse(externalReference);
        } catch {
          legacyContext = null;
        }
      }

      if (!order && !legacyContext) {
        continue;
      }

      await db.transaction(async (trx) => {
        if (order) {
          await applyOrderPayment(trx, order, payment);
        }

        if (!order && legacyContext && legacyContext.tenantId && mapPaymentStatus(paymentStatus) === ORDER_STATUS.PAID) {
          const existingTx = await trx('token_transactions')
            .where({ description: `MercadoPago Payment ${paymentId}` })
            .first();
          if (!existingTx && legacyContext.type === 'PACKAGE') {
            const pkg = await trx('token_packages').where({ id: legacyContext.itemId }).first();
            if (pkg) {
              await billingService.creditTokens(
                legacyContext.tenantId,
                pkg.tokens,
                {
                  type: 'TOKEN_PACKAGE',
                  description: `MercadoPago Payment ${paymentId}`,
                  referenceId: String(paymentId),
                },
                trx,
              );
            }
          }
          if (!existingTx && legacyContext.type === 'PLAN') {
            await trx('tenants')
              .where({ id: legacyContext.tenantId })
              .update({ plan: legacyContext.itemId, updated_at: new Date() });
          }
        }
      });
    }

    if (hasEvents) {
      await db('billing_events')
        .where({ provider, event_id: eventId })
        .update({ status: 'PROCESSED', processed_at: new Date() });
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = {
  getPlans,
  getTokenPackages,
  getPaymentGateways,
  getWallet,
  getTransactions,
  upgradePlan,
  purchasePackage,
  getOrderStatus,
  recordPaymentFailure,
  handleWebhook,
};
