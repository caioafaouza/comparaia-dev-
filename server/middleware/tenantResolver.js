const connectionManager = require('../db/connectionManager');

const tenantResolver = async (req, res, next) => {
  const path = req.path || '';

  // Admin routes must always run on master context
  if (path.startsWith('/admin')) {
    req.db = connectionManager.getMaster();
    req.isMasterContext = true;
    return next();
  }

  try {
    let tenantSlug = req.headers['x-tenant-id'] || req.query.tenantId || req.query.tenant || req.query.slug;

    // Allow body tenantSlug only in non-production environments for testing convenience
    if (process.env.NODE_ENV !== 'production' && req.body && req.body.tenantSlug) {
      tenantSlug = tenantSlug || req.body.tenantSlug;
    }

    if (!tenantSlug) {
      const host = req.headers.host || '';
      const hostname = host.split(':')[0]; // remove port if present
      const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
      if (!isIp && hostname !== 'localhost') {
        const parts = hostname.split('.');
        const ignoredSubdomains = ['www', 'api', 'app', 'admin', 'comparaia'];
        if (parts.length >= 3 && !ignoredSubdomains.includes(parts[0])) {
          tenantSlug = parts[0];
        }
      }
    }

    if (!tenantSlug && req.user && req.user.tenantId && req.user.tenantId !== 'MASTER') {
      tenantSlug = req.user.tenantId;
    }

    if (!tenantSlug) {
      console.log('[TenantResolver] No slug found, defaulting to MASTER');
      req.db = connectionManager.getMaster();
      req.isMasterContext = true;
      return next();
    }

    const masterDb = connectionManager.getMaster();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantSlug);

    console.log(`[TenantResolver] Resolving: ${tenantSlug} (UUID? ${looksLikeUuid})`);

    const tenant = await masterDb('tenants')
      .where((builder) => {
        builder.where({ slug: tenantSlug });
        if (looksLikeUuid) {
          builder.orWhere({ id: tenantSlug });
        }
      })
      .andWhere({ status: 'ACTIVE' })
      .first();

    if (!tenant) {
      console.warn(`[TenantResolver] Tenant not found for slug: ${tenantSlug}`);
      req.isMasterContext = false;
      req.tenantMissing = true;
      return next();
    }

    console.log(`[TenantResolver] Resolved: ${tenant.name} (${tenant.id})`);
    req.db = connectionManager.getTenantConnection(tenant);
    req.tenant = tenant;
    req.isMasterContext = false;

    return next();
  } catch (error) {
    console.error('[TenantResolver]', error);
    req.db = connectionManager.getMaster();
    req.isMasterContext = true;
    return next();
  }
};

module.exports = tenantResolver;
