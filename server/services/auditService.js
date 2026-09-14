const { v4: uuidv4 } = require('uuid');

const logAudit = async (req, action, resource, details) => {
  try {
    const db = req.db;
    if (!db) return;
    const hasTable = await db.schema.hasTable('audit_logs');
    if (!hasTable) return;
    await db('audit_logs').insert({
      id: uuidv4(),
      tenant_id: req.tenant?.id || null,
      user_id: req.user?.userId || req.user?.id || null,
      action,
      resource,
      details: details || null,
      created_at: new Date(),
    });
  } catch {
    // ignore audit failures
  }
};

module.exports = { logAudit };
