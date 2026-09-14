const connectionManager = require('../../db/connectionManager');
const config = require('../../config/env');

async function resetConnections() {
  try {
    if (connectionManager.tenantConnections && connectionManager.tenantConnections.size > 0) {
      for (const conn of connectionManager.tenantConnections.values()) {
        await conn.destroy();
      }
      connectionManager.tenantConnections.clear();
    }
    if (connectionManager.masterConnection) {
      await connectionManager.masterConnection.destroy();
      connectionManager.masterConnection = null;
    }
    if (typeof connectionManager.initMaster === 'function') {
      connectionManager.initMaster();
    }
  } catch (e) {
    console.warn('[TEST] resetConnections', e.message);
  }
}

/**
 * Remove schemas criados durante os testes para não poluir o master.
 * Considera schemas com prefixo "tenant_" e sufixo numérico usados pelo provisionamento.
 */
async function dropTestTenantSchemas() {
  if (!safetyCheck()) return;
  const master = connectionManager.getMaster();
  const rows = await master
    .select('schema_name')
    .from('information_schema.schemata')
    .where('schema_name', 'like', 'tenant_%');

  for (const row of rows) {
    await master.raw(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
  }
}

async function truncateMasterTables() {
  if (!safetyCheck()) {
    console.log('[TEST] Safety check failed, skipping truncate.');
    return;
  }
  console.log('[TEST] Truncating master tables...');
  const master = connectionManager.getMaster();
  // mantém usuários seedados (admin), mas limpa tenants e configs não essenciais
  await master.raw('TRUNCATE TABLE tenants RESTART IDENTITY CASCADE');
  await master.raw('TRUNCATE TABLE system_config RESTART IDENTITY CASCADE');
  // await master.raw('TRUNCATE TABLE lead_captures RESTART IDENTITY CASCADE'); // Table not found in migrations yet
  await master.raw('TRUNCATE TABLE system_api_keys RESTART IDENTITY CASCADE');
  await master.raw('TRUNCATE TABLE api_gateway_config RESTART IDENTITY CASCADE');
  await master.raw('TRUNCATE TABLE smtp_config RESTART IDENTITY CASCADE');
  // Avoid truncating users by default to keep seed admin, unless we seed in beforeEach
}

function safetyCheck() {
  const dbName = config.db.database || '';
  const host = config.db.host || '';
  const isSafe =
    process.env.ALLOW_NON_LOCAL_TEST_DB === 'true' ||
    dbName.toLowerCase().includes('test') ||
    dbName.toLowerCase().endsWith('_test') ||
    host === 'localhost' ||
    host === '127.0.0.1';

  if (!isSafe) {
    console.warn(
      `[TEST SAFETY] Skipping destructive cleanup on database "${dbName}" at host "${host}". ` +
      'Set ALLOW_NON_LOCAL_TEST_DB=true para forçar, mas use com cautela.'
    );
    return false;
  }
  console.log(`[TEST SAFETY] Check passed for ${dbName} on ${host}`);
  return true;
}

async function closeAllConnections() {
  try {
    if (connectionManager.masterConnection) {
      await connectionManager.masterConnection.destroy();
      connectionManager.masterConnection = null;
    }
    if (connectionManager.tenantConnections) {
      for (const conn of connectionManager.tenantConnections.values()) {
        await conn.destroy();
      }
      connectionManager.tenantConnections.clear();
    }
    if (connectionManager.redisClient && connectionManager.redisClient.quit) {
      await connectionManager.redisClient.quit();
      connectionManager.redisClient = null;
    }
  } catch (e) {
    console.warn('[TEST] closeAllConnections', e.message);
  }
}

async function getTenantBySlug(slug) {
  const master = connectionManager.getMaster();
  return master('tenants').where({ slug }).first();
}

function getTenantConnectionBySlug(tenant) {
  return connectionManager.getTenantConnection(tenant);
}

module.exports = {
  resetConnections,
  dropTestTenantSchemas,
  truncateMasterTables,
  closeAllConnections,
  getTenantBySlug,
  getTenantConnectionBySlug,
  seedMaster,
};

async function seedMaster() {
  const master = connectionManager.getMaster();
  // Ensure we are in a test environment
  if (!safetyCheck()) return;

  // Programmatic seed execution
  // We can rely on Knex's seed API
  await master.seed.run({
    directory: './seeds/master',
    specific: '001_plans.js'
  });
  await master.seed.run({
    directory: './seeds/master',
    specific: '002_admin.js'
  });
}
