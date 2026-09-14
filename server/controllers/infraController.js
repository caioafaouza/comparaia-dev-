const connectionManager = require('../db/connectionManager');
const config = require('../config/env');

// POST /api/admin/config/db
const updateDbConfig = async (req, res) => {
    try {
        const { host, port, name, user, pass, ssl } = req.body;
        const current = connectionManager.dbConfig.connection;
        const parsedPort = Number.isFinite(parseInt(port)) ? parseInt(port) : current.port;
        await connectionManager.updateDbConfig({
            host: host || current.host,
            port: parsedPort,
            database: name || current.database,
            user: user || current.user,
            password: pass ? pass : current.password,
            ssl: typeof ssl === 'boolean' ? (ssl ? { rejectUnauthorized: false } : false) : (current.ssl || false)
        });
        res.json({ success: true, message: 'Configura\u00e7\u00e3o de Banco de Dados atualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/admin/config/db
const getDbConfig = (req, res) => {
    const conf = connectionManager.dbConfig.connection;
    res.json({
        host: conf.host,
        port: conf.port,
        name: conf.database,
        user: conf.user,
        pass: '', // Security: never return password
        ssl: !!conf.ssl
    });
};

// GET /api/admin/config/redis
const getRedisConfig = (req, res) => {
    const conf = connectionManager.redisConfig;
    res.json({
        host: conf.host,
        port: conf.port,
        password: '',
        tls: false,
        dbIndex: 0,
        cacheTTL: 3600,
        status: conf.host ? 'CONFIGURED' : 'DISABLED'
    });
};

// POST /api/admin/config/redis
const updateRedisConfig = async (req, res) => {
    try {
        const { host, port, password } = req.body;
        const current = connectionManager.redisConfig;
        const parsedPort = Number.isFinite(parseInt(port)) ? parseInt(port) : current.port;
        await connectionManager.updateRedisConfig({
            host: host || current.host,
            port: parsedPort,
            password: password ? password : current.password
        });
        res.json({ success: true, message: 'Configura\u00e7\u00e3o Redis atualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/admin/config/storage
const getStorageConfig = (req, res) => {
    const conf = connectionManager.minioConfig;
    res.json({
        endpoint: conf.endPoint,
        port: conf.port,
        useSSL: conf.useSSL,
        accessKey: conf.accessKey || '',
        secretKey: '',
        bucket: config.storage.bucket,
        region: ''
    });
};

// POST /api/admin/config/storage
const updateStorageConfig = async (req, res) => {
    try {
        const { endpoint, port, accessKey, secretKey, useSSL, bucket } = req.body;
        const current = connectionManager.minioConfig;
        const parsedPort = Number.isFinite(parseInt(port)) ? parseInt(port) : current.port;
        await connectionManager.updateStorageConfig({
            endPoint: endpoint || current.endPoint,
            port: parsedPort,
            accessKey: accessKey || current.accessKey,
            secretKey: secretKey ? secretKey : current.secretKey,
            useSSL: typeof useSSL === 'boolean' ? useSSL : current.useSSL
        });
        if (bucket && bucket !== config.storage.bucket) {
            config.storage.bucket = bucket;
        }
        res.json({ success: true, message: 'Configura\u00e7\u00e3o Storage atualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/admin/test-connection
const testConnection = async (req, res) => {
    const { type } = req.body;
    try {
        if (type === 'db') {
            await connectionManager.getMaster().raw('SELECT 1');
        } else if (type === 'redis') {
            const redis = await connectionManager.getRedis();
            if (!redis || typeof redis.ping !== 'function') {
                throw new Error('Redis client unavailable');
            }
            await redis.ping();
        } else if (type === 'storage') {
            const storage = connectionManager.getStorage();
            if (!storage || typeof storage.listBuckets !== 'function') {
                throw new Error('Storage client unavailable');
            }
            await storage.listBuckets();
        } else {
            return res.status(400).json({ error: 'Tipo de conexão inválido.' });
        }
        res.json({ success: true, message: 'Conexão estabelecida com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Falha na conex\u00e3o: ' + error.message });
    }
};

module.exports = {
    updateDbConfig,
    getDbConfig,
    getRedisConfig,
    updateRedisConfig,
    getStorageConfig,
    updateStorageConfig,
    testConnection
};
