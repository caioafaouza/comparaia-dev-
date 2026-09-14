const knex = require('knex');
const knexfile = require('../knexfile');
const logger = require('./logger');

const getEnvKey = () => (process.env.NODE_ENV === 'production' ? 'production' : 'development');

const runMigrations = async () => {
  if (process.env.SKIP_AUTO_MIGRATIONS === 'true') {
    logger.warn('migrations.skip', { reason: 'SKIP_AUTO_MIGRATIONS=true' });
    return;
  }

  const envKey = getEnvKey();
  const masterConfig = knexfile[envKey];
  const master = knex(masterConfig);
  const summary = { env: envKey, totalTenants: 0, success: 0, failed: 0 };
  const startedAt = Date.now();

  try {
    const masterStart = Date.now();
    logger.info('migrations.master.start', { env: envKey });
    const [batchNo, log] = await master.migrate.latest();
    const masterMigrations = Array.isArray(log) ? log : [];
    logger.info('migrations.master.done', {
      batchNo,
      migrations: masterMigrations.length,
      durationMs: Date.now() - masterStart,
    });
    logger.info('migrations.master.list', { migrations: masterMigrations });
    logger.info('migrations.master.applied', {
      migrations: masterMigrations.map((name) => ({ name, status: 'applied' })),
    });

    // Run tenant migrations for each tenant schema
    const tenants = await master('tenants').select('id', 'slug', 'db_name', 'status');
    const activeTenants = tenants.filter((t) => t && t.db_name && t.db_name !== 'public');
    summary.totalTenants = activeTenants.length;

    for (const tenant of activeTenants) {
      const tenantConfig = {
        ...knexfile.tenant_template,
        connection: masterConfig.connection,
        searchPath: [tenant.db_name, 'public'],
      };

      const tenantDb = knex(tenantConfig);
      const tenantStart = Date.now();
      const ctx = { tenantId: tenant.id, slug: tenant.slug, schema: tenant.db_name };
      try {
        logger.info('migrations.tenant.start', ctx);
        const [tBatch, tLog] = await tenantDb.migrate.latest();
        const tenantMigrations = Array.isArray(tLog) ? tLog : [];
        logger.info('migrations.tenant.done', {
          ...ctx,
          batchNo: tBatch,
          migrations: tenantMigrations.length,
          durationMs: Date.now() - tenantStart,
        });
        logger.info('migrations.tenant.list', { ...ctx, migrations: tenantMigrations });
        logger.info('migrations.tenant.applied', {
          ...ctx,
          migrations: tenantMigrations.map((name) => ({ name, status: 'applied' })),
        });
        summary.success += 1;
      } catch (err) {
        summary.failed += 1;
        logger.error('migrations.tenant.error', {
          ...ctx,
          durationMs: Date.now() - tenantStart,
          error: {
            message: err?.message,
            code: err?.code,
            detail: err?.detail,
            name: err?.name,
          },
        });
        throw err;
      } finally {
        await tenantDb.destroy();
      }
    }
  } catch (err) {
    logger.error('migrations.failed', {
      message: err.message,
      code: err.code,
      detail: err.detail,
    });
    throw err;
  } finally {
    logger.info('migrations.summary', { ...summary, durationMs: Date.now() - startedAt });
    await master.destroy();
  }
};

module.exports = { runMigrations };
