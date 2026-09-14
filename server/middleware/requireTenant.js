module.exports = (req, res, next) => {
  // Allow platform admin to operate in master context (no tenant)
  if (req.user && req.user.role === 'PLATFORM_ADMIN' && req.isMasterContext) {
    // ensure master DB is set
    if (!req.db) {
      const connectionManager = require('../db/connectionManager');
      req.db = connectionManager.getMaster();
    }
    // normalize tenant placeholder
    req.tenant = {
      id: 'MASTER',
      name: 'Plataforma Compara IA',
      plan: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    };
    return next();
  }

  if (req.tenantMissing || !req.tenant || req.isMasterContext) {
    return res.status(404).json({ error: 'Tenant not found or inactive' });
  }
  return next();
};
