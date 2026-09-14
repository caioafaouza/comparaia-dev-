const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    };
    if (res.statusCode >= 500) {
      logger.error('request.error', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('request.warn', meta);
    } else {
      logger.info('request', meta);
    }
  });

  next();
};
