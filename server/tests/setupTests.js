const { resetConnections, dropTestTenantSchemas, truncateMasterTables, closeAllConnections, seedMaster } = require('./helpers/dbUtils');

beforeAll(async () => {
  await seedMaster();
});

beforeEach(async () => {
  await resetConnections();
  await truncateMasterTables();
  await dropTestTenantSchemas();
});

afterAll(async () => {
  await dropTestTenantSchemas();
  await closeAllConnections();
});
