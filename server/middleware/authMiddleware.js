const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authMiddleware = ({ requireTenant = false, roles = [], optional = false } = {}) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      if (optional) return next();
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    try {
      const payload = jwt.verify(token, config.security.jwtSecret);
      req.user = payload;

      if (requireTenant) {
        if (req.tenantMissing || !req.tenant || req.isMasterContext) {
          return res.status(404).json({ error: 'Tenant context required' });
        }
        if (payload.tenantId && payload.tenantId !== req.tenant.id) {
          return res.status(403).json({ error: 'Token tenant mismatch' });
        }
      }

      if (roles.length > 0 && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient role' });
      }

      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};

module.exports = authMiddleware;
