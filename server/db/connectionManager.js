const knex = require('knex');
const Redis = require('ioredis');
const Minio = require('minio');
const config = require('../config/env');
const isTest = config.env === 'test';

class ConnectionManager {
  constructor() {
    const isTestEnv = config.env === 'test';

    this.dbConfig = {
      client: config.db.client,
      connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        ssl: config.db.ssl || false,
        connectionTimeoutMillis: 10000,
        statement_timeout: 15000,
      },
      pool: {
        min: 0,
        max: 5,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
        propagateCreateError: false
      },
      acquireConnectionTimeout: 20000,
    };

    this.redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      username: config.redis.username,
      password: config.redis.password,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    };

    this.minioConfig = {
      endPoint: config.storage.endPoint,
      port: config.storage.port,
      useSSL: config.storage.useSSL,
      accessKey: config.storage.accessKey,
      secretKey: config.storage.secretKey,
    };

    this.masterConnection = null;
    this.tenantConnections = new Map();
    this.redisClient = null;
    this.minioClient = null;

    // Do NOT initMaster() immediately. Let it be lazy.
    // this.initMaster();
  }

  // --- DATABASE (POSTGRES) ---

  initMaster() {
    try {
      if (this.masterConnection) {
        return; // Already initialized
      }
      this.masterConnection = knex({
        ...this.dbConfig,
        searchPath: ['public'],
      });
      console.log(`[DB] Master connection initialized to ${config.db.host} / ${config.db.database}`);
    } catch (e) {
      console.error('[DB] Failed to init master:', e);
    }
  }

  getMaster() {
    if (!this.masterConnection) this.initMaster();
    return this.masterConnection;
  }

  getTenantConnection(tenantData) {
    const tenantId = tenantData.id;

    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId);
    }

    // Limit tenant connection cache size to prevent connection pool exhaustion
    const MAX_CACHED_TENANT_CONNS = isTest ? 10 : 25;
    if (this.tenantConnections.size >= MAX_CACHED_TENANT_CONNS) {
      const oldestKey = this.tenantConnections.keys().next().value;
      if (oldestKey) {
        const oldConn = this.tenantConnections.get(oldestKey);
        this.tenantConnections.delete(oldestKey);
        oldConn?.destroy().catch(() => null);
      }
    }

    const tenantPool = {
      min: 0,
      max: isTest ? 2 : 4,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    };

    const connection = knex({
      ...this.dbConfig,
      searchPath: [tenantData.db_name, 'public'],
      pool: tenantPool,
    });

    this.tenantConnections.set(tenantId, connection);
    return connection;
  }

  async updateDbConfig(newConfig) {
    this.dbConfig.connection = { ...this.dbConfig.connection, ...newConfig };
    await this.destroy();
    return true;
  }

  // Added method to cleanly close all connections
  async destroy() {
    console.log('[ConnectionManager] Closing all connections...');
    if (this.masterConnection) {
      await this.masterConnection.destroy();
      this.masterConnection = null;
    }

    for (const [id, conn] of this.tenantConnections) {
      await conn.destroy();
    }
    this.tenantConnections.clear();

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }

  // --- REDIS ---

  async getRedis() {
    if (isTest) {
      return {
        ping: async () => 'PONG',
        quit: async () => { },
        duplicate: () => ({
          on: () => { },
          connect: async () => { },
          subscribe: async () => { },
          publish: async () => { },
          disconnect: async () => { }
        }),
      };
    }
    if (!this.redisClient) {
      try {
        const client = new Redis(this.redisConfig);
        client.on('error', (err) => {
          const isDev = config.env !== 'production';
          if (isDev && err.code === 'ECONNREFUSED') {
            console.warn('[Redis] Connection refused - cache disabled in dev');
            this.redisClient = null;
          } else {
            // Suppress verbose error logging for now if expected
            console.error('[Redis] Error:', err.message);
          }
        });
        await client.connect().catch((err) => {
          console.warn('[Redis] Deferred connection:', err.message);
        });
        this.redisClient = client;
        console.log('[Redis] Client initialized');
      } catch (e) {
        console.error('[Redis] Init failed', e);
        this.redisClient = null;
      }
    }
    return this.redisClient;
  }

  async updateRedisConfig(newConfig) {
    if (this.redisClient) await this.redisClient.quit();
    this.redisConfig = { ...this.redisConfig, ...newConfig };
    this.redisClient = null;
    return true;
  }

  // --- MINIO / S3 ---

  getStorage() {
    if (isTest) {
      return {
        bucketExists: async () => true,
        makeBucket: async () => { },
        listBuckets: async () => [],
      };
    }
    if (!this.minioClient) {
      try {
        this.minioClient = new Minio.Client(this.minioConfig);
        console.log('[Storage] Client initialized');
      } catch (e) {
        console.error('[Storage] Init failed', e);
      }
    }
    return this.minioClient;
  }

  async ensureBucket(bucketName) {
    const storage = this.getStorage();
    if (!storage) return false;
    const exists = await storage.bucketExists(bucketName);
    if (!exists) {
      await storage.makeBucket(bucketName, '');
    }
    return true;
  }

  async updateStorageConfig(newConfig) {
    this.minioConfig = { ...this.minioConfig, ...newConfig };
    this.minioClient = null;
    return true;
  }
}

module.exports = new ConnectionManager();
