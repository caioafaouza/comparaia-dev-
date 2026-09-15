// Application factory to allow reuse in tests (Supertest) and production
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const config = require('./config/env');
const connectionManager = require('./db/connectionManager');
const tenantResolver = require('./middleware/tenantResolver');
const requireTenant = require('./middleware/requireTenant');
const authMiddleware = require('./middleware/authMiddleware');
const requestContext = require('./middleware/requestContext');

const provisioningService = require('./services/provisioningService');
const aiController = require('./controllers/aiController');
const inventoryController = require('./controllers/inventoryController');
const dashboardController = require('./controllers/dashboardController');
const infraController = require('./controllers/infraController');
const adminController = require('./controllers/adminController');
const platformAdminController = require('./controllers/platformAdminController');
const tenantController = require('./controllers/tenantController');
const billingController = require('./controllers/billingController');
const monitoringController = require('./controllers/monitoringController');
const authController = require('./controllers/authController');
const jobController = require('./controllers/jobController');
const healthController = require('./controllers/healthController');

function createApp() {
  const app = express();

  // Fix for "The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false"
  // Required when running behind AAPanel / Nginx
  app.set('trust proxy', 1);

  const corsOptions = {
    origin: (origin, callback) => {
      const isLocalHost = origin && origin.startsWith(`http://localhost:${config.port}`);
      if (
        !origin ||
        config.security.corsOrigins.includes('*') ||
        config.security.corsOrigins.includes(origin) ||
        isLocalHost
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id', 'X-Request-Id'],
  };

  const isTest = config.env === 'test';
  const enableRateLimit = process.env.NODE_ENV === 'production' || process.env.ENABLE_RATE_LIMIT === 'true';
  const passthrough = (_req, _res, next) => next();

  const loginLimiter = enableRateLimit
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: process.env.TEST_RATE_LIMIT === 'true' ? 2 : 20,
      standardHeaders: true,
      legacyHeaders: false,
    })
    : passthrough;

  const tenantRegistrationLimiter = enableRateLimit
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: process.env.TEST_RATE_LIMIT === 'true' ? 2 : 5,
      standardHeaders: true,
      legacyHeaders: false,
    })
    : passthrough;

  const aiLimiter = enableRateLimit
    ? rateLimit({
      windowMs: 60 * 1000,
      limit: process.env.TEST_RATE_LIMIT === 'true' ? 2 : 30,
      standardHeaders: true,
      legacyHeaders: false,
    })
    : passthrough;

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors(corsOptions));
  app.use(requestContext);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, '../dist')));

  const apiRouter = express.Router();

  // --- Health ---
  apiRouter.get('/health', healthController.health);
  apiRouter.get('/health/db', healthController.dbHealth);
  apiRouter.get('/health/redis', healthController.redisHealth);
  apiRouter.get('/health/storage', healthController.storageHealth);

  // --- Public config (branding & app name) ---
  apiRouter.get('/config/public', adminController.getPublicConfig);

  // --- Tenant resolution applied to the remaining routes ---
  apiRouter.use(tenantResolver);

  const adminGuard = authMiddleware({ requireTenant: false, roles: ['PLATFORM_ADMIN'] });

  // --- ADMIN / INFRA ---
  apiRouter.get('/admin/config', adminGuard, adminController.getGlobalConfig);
  apiRouter.post('/admin/config', adminGuard, adminController.updateGlobalConfig);
  apiRouter.get('/admin/llm/smoke', adminGuard, adminController.testAIProvider);
  apiRouter.get('/admin/openai-models', adminGuard, adminController.getOpenAIModels);
  apiRouter.get('/admin/gemini-models', adminGuard, adminController.getGeminiModels);
  apiRouter.get('/admin/anthropic-models', adminGuard, adminController.getAnthropicModels);
  apiRouter.get('/admin/tenants', adminGuard, adminController.getAllTenants);
  apiRouter.patch('/admin/tenants/:id', adminGuard, adminController.updateTenant);
  apiRouter.delete('/admin/tenants/:id', adminGuard, adminController.deleteTenant);
  apiRouter.get('/admin/users', adminGuard, adminController.getAllUsersGlobal);
  apiRouter.patch('/admin/users/:id', adminGuard, adminController.updateGlobalUser);
  apiRouter.delete('/admin/users/:id', adminGuard, adminController.deleteGlobalUser);
  apiRouter.get('/admin/overview', adminGuard, adminController.getDashboardOverview);
  apiRouter.post('/admin/impersonate', adminGuard, authController.impersonate);
  apiRouter.get('/admin/system-health', adminGuard, monitoringController.getSystemHealth);
  apiRouter.post('/admin/system-health/maintenance', adminGuard, monitoringController.toggleMaintenance);
  apiRouter.post('/admin/system-health/cache/clear', adminGuard, monitoringController.clearCache);
  apiRouter.get('/admin/logs', adminGuard, monitoringController.getLogs);
  apiRouter.get('/admin/ai-usage', adminGuard, monitoringController.getAIUsage);

  apiRouter.get('/admin/config/db', adminGuard, infraController.getDbConfig);
  apiRouter.post('/admin/config/db', adminGuard, infraController.updateDbConfig);
  apiRouter.get('/admin/config/redis', adminGuard, infraController.getRedisConfig);
  apiRouter.post('/admin/config/redis', adminGuard, infraController.updateRedisConfig);
  apiRouter.get('/admin/config/storage', adminGuard, infraController.getStorageConfig);
  apiRouter.post('/admin/config/storage', adminGuard, infraController.updateStorageConfig);
  apiRouter.post('/admin/test-connection', adminGuard, infraController.testConnection);

  // --- ADMIN MODULES ---
  apiRouter.get('/admin/api-gateway', adminGuard, platformAdminController.getApiGatewayConfig);
  apiRouter.post('/admin/api-gateway', adminGuard, platformAdminController.updateApiGatewayConfig);
  apiRouter.get('/admin/api-spec', adminGuard, platformAdminController.getApiSpec);
  apiRouter.get('/admin/system-keys', adminGuard, platformAdminController.getSystemApiKeys);
  apiRouter.post('/admin/system-keys', adminGuard, platformAdminController.createSystemApiKey);
  apiRouter.post('/admin/system-keys/:id/revoke', adminGuard, platformAdminController.revokeSystemApiKey);

  apiRouter.get('/admin/config/smtp', adminGuard, platformAdminController.getSmtpConfig);
  apiRouter.post('/admin/config/smtp', adminGuard, platformAdminController.updateSmtpConfig);
  apiRouter.post('/admin/config/smtp/test', adminGuard, platformAdminController.testSmtpConnection);
  apiRouter.get('/admin/config/email-templates', adminGuard, platformAdminController.getTransactionalEmailTemplates);
  apiRouter.post('/admin/config/email-templates', adminGuard, platformAdminController.updateTransactionalEmailTemplates);
  apiRouter.post('/admin/config/email-templates/:key', adminGuard, platformAdminController.updateTransactionalEmailTemplateByKey);

  apiRouter.get('/admin/crm/leads', adminGuard, platformAdminController.getCRMLeads);
  apiRouter.post('/admin/crm/leads', adminGuard, platformAdminController.createCRMLead);
  apiRouter.patch('/admin/crm/leads/:id', adminGuard, platformAdminController.updateCRMLead);
  apiRouter.delete('/admin/crm/leads/:id', adminGuard, platformAdminController.deleteCRMLead);

  apiRouter.get('/admin/plans', adminGuard, platformAdminController.getPlans);
  apiRouter.post('/admin/plans', adminGuard, platformAdminController.createPlan);
  apiRouter.patch('/admin/plans/:id', adminGuard, platformAdminController.updatePlan);
  apiRouter.delete('/admin/plans/:id', adminGuard, platformAdminController.deletePlan);

  apiRouter.get('/admin/token-packages', adminGuard, platformAdminController.getTokenPackages);
  apiRouter.post('/admin/token-packages', adminGuard, platformAdminController.createTokenPackage);
  apiRouter.delete('/admin/token-packages/:id', adminGuard, platformAdminController.deleteTokenPackage);

  apiRouter.post('/admin/tokens/refill', adminGuard, platformAdminController.adminRefillTokens);
  apiRouter.get('/admin/transactions', adminGuard, platformAdminController.getTransactions);

  apiRouter.get('/admin/webhooks', adminGuard, platformAdminController.getWebhooks);
  apiRouter.post('/admin/webhooks', adminGuard, platformAdminController.createWebhook);
  apiRouter.patch('/admin/webhooks/:id', adminGuard, platformAdminController.updateWebhook);
  apiRouter.delete('/admin/webhooks/:id', adminGuard, platformAdminController.deleteWebhook);
  apiRouter.get('/admin/webhooks/:id/logs', adminGuard, platformAdminController.getWebhookLogs);
  apiRouter.post('/admin/webhooks/:id/test', adminGuard, platformAdminController.testWebhook);

  apiRouter.get('/admin/payment-gateways', adminGuard, platformAdminController.getPaymentGateways);
  apiRouter.post('/admin/payment-gateways', adminGuard, platformAdminController.upsertPaymentGateway);
  apiRouter.delete('/admin/payment-gateways/:provider', adminGuard, platformAdminController.deletePaymentGateway);

  apiRouter.get('/admin/notifications', adminGuard, platformAdminController.getNotifications);

  // --- PUBLIC (Master context only) ---
  apiRouter.post(
    '/register-tenant',
    tenantRegistrationLimiter,
    authMiddleware({ requireTenant: false, optional: true }), // popula req.user se houver token
    async (req, res) => {
      // Se for PLATFORM_ADMIN autenticado, força contexto master
      if (req.user && req.user.role === 'PLATFORM_ADMIN') {
        req.isMasterContext = true;
      }
      // Permitir se for master OU se usuário autenticado for PLATFORM_ADMIN
      if (!req.isMasterContext && !(req.user && req.user.role === 'PLATFORM_ADMIN')) {
        return res.status(403).json({ error: 'Proibido. Use o domínio principal.' });
      }
      try {
        const result = await provisioningService.registerTenant(req.body);
        res.status(201).json(result);
      } catch (error) {
        const status = Number(error?.statusCode) || 400;
        res.status(status).json({ error: error.message });
      }
    },
  );

  // --- AUTH ---
  apiRouter.post('/auth/login', loginLimiter, authController.login);
  apiRouter.post('/auth/password-reset/request', loginLimiter, authController.requestPasswordReset);
  apiRouter.post('/auth/password-reset/verify', loginLimiter, authController.verifyPasswordResetCode);
  apiRouter.post('/auth/password-reset/confirm', loginLimiter, authController.confirmPasswordReset);

  // Public CRM lead capture (landing page)
  apiRouter.post('/crm/leads', platformAdminController.createCRMLead);

  const upload = multer({ dest: 'uploads/' });
  const tenantGuard = [requireTenant, authMiddleware({ requireTenant: true })];

  // Tenant details & users
  apiRouter.get('/tenant/details', tenantGuard, tenantController.getTenantDetails);
  apiRouter.patch('/tenant/details', tenantGuard, tenantController.updateTenantSelf);
  apiRouter.delete('/tenant/details', tenantGuard, tenantController.deleteTenantSelf);
  apiRouter.get('/users', tenantGuard, tenantController.listUsers);
  apiRouter.post('/users', tenantGuard, tenantController.createUser);
  apiRouter.post('/users/invite', tenantGuard, tenantController.inviteUser);
  apiRouter.patch('/users/:id', tenantGuard, tenantController.updateUser);
  apiRouter.delete('/users/:id', tenantGuard, tenantController.deleteUser);
  apiRouter.get('/audit/logs', tenantGuard, tenantController.getAuditLogs);
  apiRouter.get('/tenant/api-keys', tenantGuard, tenantController.getTenantApiKeys);
  apiRouter.post('/tenant/api-keys', tenantGuard, tenantController.createTenantApiKey);
  apiRouter.post('/tenant/api-keys/:id/revoke', tenantGuard, tenantController.revokeTenantApiKey);

  // Billing (tenant)
  apiRouter.get('/billing/wallet', tenantGuard, billingController.getWallet);
  apiRouter.get('/billing/transactions', tenantGuard, billingController.getTransactions);
  apiRouter.post('/billing/upgrade-plan', tenantGuard, billingController.upgradePlan);
  apiRouter.post('/billing/purchase-package', tenantGuard, billingController.purchasePackage);
  apiRouter.get('/billing/orders/:orderId', tenantGuard, billingController.getOrderStatus);
  apiRouter.post('/billing/payment-failure', tenantGuard, billingController.recordPaymentFailure);
  apiRouter.get('/billing/payment-gateways', tenantGuard, billingController.getPaymentGateways);
  apiRouter.get('/plans', tenantGuard, billingController.getPlans);
  apiRouter.get('/token-packages', tenantGuard, billingController.getTokenPackages);
  apiRouter.post('/billing/webhook/mercadopago', billingController.handleWebhook);
  apiRouter.get('/billing/webhook/mercadopago', billingController.handleWebhook);

  // Jobs
  apiRouter.get('/jobs', tenantGuard, jobController.listJobs);
  apiRouter.get('/jobs/:id', tenantGuard, jobController.getJob);
  apiRouter.get('/jobs/:id/report/pdf', tenantGuard, jobController.getJobReportPdf);
  apiRouter.post('/jobs', ...tenantGuard, upload.any(), jobController.createJob);
  apiRouter.patch('/jobs/:id', tenantGuard, jobController.updateJob);
  apiRouter.delete('/jobs/:id', tenantGuard, jobController.deleteJob);

  // Dashboard & IA
  apiRouter.get('/dashboard/metrics', tenantGuard, dashboardController.getMetrics);
  apiRouter.get('/products/:productId/intelligence', tenantGuard, inventoryController.getProductIntelligence);
  apiRouter.post('/ai/shopping-assistant', aiLimiter, tenantGuard, aiController.getShoppingAssistant);
  apiRouter.post('/ai/compare', aiLimiter, tenantGuard, aiController.compareProducts);
  apiRouter.post('/ai/analyze-raw', aiLimiter, tenantGuard, aiController.analyzeRaw);
  apiRouter.post('/ai/rfq', aiLimiter, tenantGuard, aiController.generateRfq);
  apiRouter.post('/ai/chat', aiLimiter, tenantGuard, aiController.chatWithReport);

  // Test-only utilities (used for security tests)
  if (isTest) {
    apiRouter.get('/__test__/boom', () => {
      const err = new Error('Boom!');
      err.status = 500;
      throw err;
    });
  }

  app.use('/api', apiRouter);

  // Fallback for SPA
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });

  // Ensure storage bucket exists on boot (non-blocking)
  connectionManager.ensureBucket(config.storage.bucket).catch((err) => {
    console.warn('[Storage] Bucket ensure skipped:', err.message);
  });

  // Central error handler (avoids stack traces in responses)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const message = status === 500 ? 'Internal server error' : err.message || 'Error';
    const logger = require('./utils/logger');
    logger.error('handler.error', { requestId: req.requestId, status, message }, err);
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
