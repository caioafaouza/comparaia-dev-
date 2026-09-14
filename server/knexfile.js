const env = require('./config/env');

const baseConnection = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl,
};

module.exports = {
  development: {
    client: env.db.client,
    connection: baseConnection,
    migrations: {
      directory: './migrations/master',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds/master',
    },
    pool: { min: 2, max: 10 },
  },

  production: {
    client: env.db.client,
    connection: baseConnection,
    migrations: {
      directory: './migrations/master',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds/master',
    },
    pool: { min: 2, max: 10 },
  },

  tenant_template: {
    client: env.db.client,
    connection: {
      ...baseConnection,
      // use TENANT_SCHEMA env when running template migrations for a specific schema
    },
    searchPath: [process.env.TENANT_SCHEMA || 'public'],
    migrations: {
      directory: './migrations/tenant',
      tableName: 'knex_migrations_tenant',
    },
    seeds: {
      directory: './seeds/tenant',
    },
    pool: { min: 1, max: 5 },
  },
};
