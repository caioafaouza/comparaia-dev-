const { createApp } = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { runMigrations } = require('./utils/migrationRunner');

const app = createApp();

const startServer = async () => {
  if (process.env.NODE_ENV === 'test') return;
  await runMigrations();
  const PORT = config.port || 3000;
  app.listen(PORT, () => {
    logger.info('server.start', { port: PORT });
  });
};

startServer().catch((err) => {
  logger.error('server.start.failed', { message: err.message }, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandledRejection', { reason: String(reason) }, reason);
});

process.on('uncaughtException', (err) => {
  logger.error('process.uncaughtException', { message: err.message }, err);
});

module.exports = app;
