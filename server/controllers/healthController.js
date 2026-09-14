const connectionManager = require('../db/connectionManager');
const config = require('../config/env');

const health = async (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
};

const dbHealth = async (_req, res) => {
  try {
    console.info('[Health] dbHealth hit');
    await connectionManager.getMaster().raw('select 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[Health] dbHealth error', err);
    res.status(503).json({ status: 'degraded', error: err.message });
  }
};

const redisHealth = async (_req, res) => {
  try {
    const redis = await connectionManager.getRedis();
    if (!redis) throw new Error('Redis client unavailable');
    await redis.ping();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
};

const storageHealth = async (_req, res) => {
  try {
    const storage = connectionManager.getStorage();
    if (!storage) throw new Error('Storage client unavailable');
    await connectionManager.ensureBucket(config.storage.bucket);
    res.json({ status: 'ok', bucket: config.storage.bucket });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
};

module.exports = { health, dbHealth, redisHealth, storageHealth };
