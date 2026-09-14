const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require('mercadopago');
const connectionManager = require('../db/connectionManager');
const billingService = require('./billingService');

const DEFAULT_TIMEOUT_MS = Number(process.env.MP_TIMEOUT_MS || 8000);
const DEFAULT_RETRIES = Number(process.env.MP_RETRIES || 1);

const sanitizeError = (err) => {
  if (!err) return { message: 'unknown_error' };
  return {
    message: err.message || 'unknown_error',
    name: err.name,
    status: err.status,
    cause: err.cause ? '[redacted]' : undefined,
  };
};

class MercadoPagoService {
  async getGatewayConfig() {
    const envToken = process.env.MP_ACCESS_TOKEN;
    if (envToken) {
      return {
        accessToken: envToken,
        source: 'env',
        provider: 'MERCADO_PAGO',
      };
    }

    const db = connectionManager.getMaster();
    const gateway = await db('payment_gateways')
      .whereRaw('lower(provider) in (?, ?)', ['mercado_pago', 'mercadopago'])
      .andWhere({ active: true })
      .first();

    if (!gateway) {
      throw new Error('Gateway Mercado Pago não configurado ou inativo.');
    }

    const credentials = billingService.safeJsonParse(gateway.credentials, {});
    const accessToken =
      credentials.accessToken ||
      credentials.secretKey ||
      credentials.access_token ||
      credentials.token;

    if (!accessToken) {
      throw new Error('Access Token do Mercado Pago não encontrado.');
    }

    return {
      accessToken,
      provider: gateway.provider,
      source: 'db',
    };
  }

  async getClient() {
    const gateway = await this.getGatewayConfig();
    return new MercadoPagoConfig({
      accessToken: gateway.accessToken,
      options: {
        timeout: DEFAULT_TIMEOUT_MS,
        integratorId: process.env.MP_INTEGRATOR_ID,
        platformId: process.env.MP_PLATFORM_ID,
      },
    });
  }

  buildRequestOptions({ idempotencyKey, timeoutMs, retries } = {}) {
    const opts = {};
    if (idempotencyKey) opts.idempotencyKey = idempotencyKey;
    opts.timeout = timeoutMs || DEFAULT_TIMEOUT_MS;
    opts.retries = Number.isFinite(retries) ? retries : DEFAULT_RETRIES;
    return opts;
  }

  async createPreference(items, payer, context = {}, options = {}) {
    const client = await this.getClient();
    const preference = new Preference(client);

    const normalizedContext =
      typeof context === 'string' ? { externalReference: context } : (context || {});

    const externalReference = normalizedContext.externalReference || normalizedContext.external_reference;
    const metadata = normalizedContext.metadata || undefined;
    const backUrls = normalizedContext.backUrls || normalizedContext.back_urls;
    const notificationUrl = normalizedContext.notificationUrl || normalizedContext.notification_url;

    const body = {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        currency_id: 'BRL',
      })),
      payer: {
        email: payer.email,
        name: payer.name || 'Cliente',
      },
      external_reference: externalReference,
      metadata,
      back_urls: backUrls || {
        success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?status=success`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?status=failure`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?status=pending`,
      },
      auto_return: 'approved',
      notification_url:
        notificationUrl ||
        `${process.env.BACKEND_URL || 'https://api.comparaia.com'}/api/billing/webhook/mercadopago`,
    };

    try {
      const requestOptions = this.buildRequestOptions({
        idempotencyKey: options.idempotencyKey || normalizedContext.idempotencyKey,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
      });
      const result = await preference.create({ body, requestOptions });
      return result;
    } catch (error) {
      console.error('Mercado Pago Preference Error:', sanitizeError(error));
      throw new Error(`Erro ao criar preferência de pagamento: ${error.message || 'unknown'}`);
    }
  }

  async getPayment(paymentId, options = {}) {
    const client = await this.getClient();
    const paymentClient = new Payment(client);
    try {
      const requestOptions = this.buildRequestOptions({
        idempotencyKey: options.idempotencyKey,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
      });
      return await paymentClient.get({ id: paymentId, requestOptions });
    } catch (error) {
      console.error('Mercado Pago Payment Error:', sanitizeError(error));
      throw error;
    }
  }

  async getMerchantOrder(merchantOrderId, options = {}) {
    const client = await this.getClient();
    const merchantOrderClient = new MerchantOrder(client);
    try {
      const requestOptions = this.buildRequestOptions({
        idempotencyKey: options.idempotencyKey,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
      });
      return await merchantOrderClient.get({ merchantOrderId, requestOptions });
    } catch (error) {
      console.error('Mercado Pago MerchantOrder Error:', sanitizeError(error));
      throw error;
    }
  }

  async searchPaymentsByExternalReference(externalReference, options = {}) {
    if (!externalReference) return [];
    const client = await this.getClient();
    const paymentClient = new Payment(client);
    try {
      const requestOptions = this.buildRequestOptions({
        idempotencyKey: options.idempotencyKey,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
      });

      const result = await paymentClient.search({
        options: {
          external_reference: externalReference,
          sort: 'date_created',
          criteria: 'desc',
        },
        requestOptions,
      });

      if (!Array.isArray(result?.results)) return [];
      return result.results;
    } catch (error) {
      console.error('Mercado Pago Payment Search Error:', sanitizeError(error));
      throw error;
    }
  }
}

module.exports = new MercadoPagoService();
