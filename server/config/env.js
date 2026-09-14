const dotenv = require('dotenv');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

const loadEnvFile = (envPath, override = false) => {
  try {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override });
      return true;
    }
  } catch { }
  return false;
};

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test', override: true });
} else {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
  ];
  const seen = new Set();
  for (const envPath of candidates) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);
    loadEnvFile(envPath, false);
  }
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_BUCKET: z.string().min(1, 'MINIO_BUCKET is required'),
  KEY_ENCRYPTION_SECRET: z.string().min(32, 'KEY_ENCRYPTION_SECRET must be at least 32 chars'),
  JWT_SECRET: z.string().min(12, 'JWT_SECRET must be at least 12 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed:');
  parsed.error.errors.forEach((err) => {
    console.error(`- ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

const raw = parsed.data;
const corsOrigins =
  raw.CORS_ORIGINS === '*'
    ? ['*']
    : raw.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

module.exports = {
  env: raw.NODE_ENV,
  port: raw.PORT,
  db: {
    client: 'pg',
    host: raw.DB_HOST,
    port: raw.DB_PORT,
    user: raw.DB_USER,
    password: raw.DB_PASSWORD,
    database: raw.DB_NAME,
    ssl: raw.DB_SSL ? { rejectUnauthorized: false } : false,
  },
  redis: {
    host: raw.REDIS_HOST,
    port: raw.REDIS_PORT,
    username: raw.REDIS_USERNAME,
    password: raw.REDIS_PASSWORD,
  },
  storage: {
    endPoint: raw.MINIO_ENDPOINT,
    port: raw.MINIO_PORT,
    useSSL: raw.MINIO_USE_SSL,
    accessKey: raw.MINIO_ACCESS_KEY,
    secretKey: raw.MINIO_SECRET_KEY,
    bucket: raw.MINIO_BUCKET,
  },
  security: {
    jwtSecret: raw.JWT_SECRET,
    jwtExpiresIn: raw.JWT_EXPIRES_IN,
    corsOrigins,
    logLevel: raw.LOG_LEVEL,
    cryptoKey: raw.KEY_ENCRYPTION_SECRET,
  },
};
