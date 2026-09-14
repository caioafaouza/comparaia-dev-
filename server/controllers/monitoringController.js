const fs = require('fs');
const path = require('path');
const os = require('os');
const connectionManager = require('../db/connectionManager');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const APP_LOG = path.join(LOG_DIR, 'app.log');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');

// Default estimated prices in USD per 1M tokens.
// You can override/extend via GLOBAL_CONFIG.aiModelPricingUSDPer1M.
const DEFAULT_MODEL_PRICING_USD_PER_1M = {
  'gpt-5': { input: 1.25, output: 10.0 },
  'gpt-5.1': { input: 1.25, output: 10.0 },
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeModelKey = (value) => String(value || '').trim().toLowerCase();

const normalizePricingMap = (rawPricing) => {
  if (!rawPricing || typeof rawPricing !== 'object') return {};
  const map = {};
  Object.entries(rawPricing).forEach(([modelKey, entry]) => {
    if (!entry || typeof entry !== 'object') return;
    const normalizedKey = normalizeModelKey(modelKey);
    if (!normalizedKey) return;
    const input = toNumber(entry.input ?? entry.in ?? entry.prompt ?? entry.promptTokens, 0);
    const output = toNumber(entry.output ?? entry.out ?? entry.completion ?? entry.completionTokens, 0);
    map[normalizedKey] = { input, output };
  });
  return map;
};

const resolveModelPricing = (model, pricingMap) => {
  const normalized = normalizeModelKey(model);
  if (!normalized) return null;
  if (pricingMap[normalized]) return pricingMap[normalized];

  const keys = Object.keys(pricingMap).sort((a, b) => b.length - a.length);
  const prefix = keys.find((key) => normalized.startsWith(`${key}-`) || normalized === key);
  return prefix ? pricingMap[prefix] : null;
};

const estimateCostUsd = (row, pricingMap) => {
  const pricing = resolveModelPricing(row.model, pricingMap);
  if (!pricing) return 0;
  const tokensIn = toNumber(row.tokens_in, 0);
  const tokensOut = toNumber(row.tokens_out, 0);
  const inCost = (tokensIn / 1_000_000) * toNumber(pricing.input, 0);
  const outCost = (tokensOut / 1_000_000) * toNumber(pricing.output, 0);
  return inCost + outCost;
};

const readSystemFlag = async (key, fallback) => {
  try {
    const db = connectionManager.getMaster();
    const row = await db('system_config').where({ key }).first();
    if (!row) return fallback;
    const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return value;
  } catch {
    return fallback;
  }
};

const writeSystemFlag = async (key, value) => {
  const db = connectionManager.getMaster();
  const existing = await db('system_config').where({ key }).first();
  if (existing) {
    await db('system_config').where({ key }).update({ value: JSON.stringify(value), updated_at: new Date() });
  } else {
    await db('system_config').insert({ key, value: JSON.stringify(value), created_at: new Date(), updated_at: new Date() });
  }
};

const measure = async (fn) => {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latency: Date.now() - start };
  } catch (error) {
    return { ok: false, latency: Date.now() - start, error: error.message };
  }
};

const formatService = (name, probe) => {
  const status = probe.ok ? 'operational' : 'down';
  const latency = probe.latency || 0;
  const history = Array.from({ length: 6 }, () => Math.max(5, latency));
  return {
    name,
    status,
    latency,
    uptime: probe.ok ? 100 : 0,
    history,
  };
};

const getSystemHealth = async (_req, res) => {
  try {
    const cpuCount = os.cpus().length || 1;
    const load = os.loadavg()[0] || 0;
    const cpuLoad = Math.min(100, Math.round((load / cpuCount) * 100));
    const totalMem = os.totalmem() || 1;
    const freeMem = os.freemem() || 0;
    const memoryUsage = Math.min(100, Math.round(((totalMem - freeMem) / totalMem) * 100));

    const masterDb = connectionManager.getMaster();
    const dbProbe = await measure(() => masterDb.raw('SELECT 1'));

    const redisProbe = await measure(async () => {
      const redis = await connectionManager.getRedis();
      if (!redis || typeof redis.ping !== 'function') throw new Error('Redis indisponível');
      await redis.ping();
    });

    const storageProbe = await measure(async () => {
      const storage = connectionManager.getStorage();
      if (!storage || typeof storage.listBuckets !== 'function') throw new Error('Storage indisponível');
      await storage.listBuckets();
    });

    const dbSize = await (async () => {
      try {
        const result = await masterDb.raw(
          'SELECT pg_size_pretty(pg_database_size(current_database())) as size',
        );
        const row = Array.isArray(result?.rows) ? result.rows[0] : result?.[0]?.[0];
        return row?.size || 'N/A';
      } catch {
        return 'N/A';
      }
    })();

    const maintenanceMode = await readSystemFlag('MAINTENANCE_MODE', false);
    const lastBackup = await readSystemFlag('LAST_BACKUP', null);

    const activeHandles = (() => {
      try {
        return process._getActiveHandles().length;
      } catch {
        return 0;
      }
    })();

    const errorRate = await (async () => {
      try {
        if (!fs.existsSync(ERROR_LOG)) return 0;
        const data = fs.readFileSync(ERROR_LOG, 'utf8');
        const lines = data.split('\n').filter(Boolean);
        return lines.length > 0 ? Math.min(100, lines.length) : 0;
      } catch {
        return 0;
      }
    })();

    const services = [
      formatService('API', { ok: true, latency: 0 }),
      formatService('Postgres', dbProbe),
      formatService('Redis', redisProbe),
      formatService('Storage', storageProbe),
    ];

    return res.json({
      services,
      maintenanceMode: !!maintenanceMode,
      lastBackup: lastBackup || null,
      dbSize,
      cpuLoad,
      memoryUsage,
      activeThreads: activeHandles,
      errorRate,
    });
  } catch (error) {
    console.error('System health error:', error);
    return res.status(500).json({ error: 'Erro ao carregar saúde do sistema.' });
  }
};

const toggleMaintenance = async (req, res) => {
  try {
    const { enabled } = req.body || {};
    await writeSystemFlag('MAINTENANCE_MODE', !!enabled);
    return res.json({ success: true });
  } catch (error) {
    console.error('Maintenance toggle error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar manutenção.' });
  }
};

const clearCache = async (_req, res) => {
  try {
    const redis = await connectionManager.getRedis();
    if (redis && typeof redis.flushall === 'function') {
      await redis.flushall();
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Clear cache error:', error);
    return res.status(500).json({ error: 'Erro ao limpar cache.' });
  }
};

const parseLogLine = (line) => {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+([A-Z]+)\s+(.+)$/);
  if (!match) return null;
  const [, timestamp, level, rest] = match;
  const metaMatch = rest.match(/(.*)\s(\{.*\})$/);
  const message = metaMatch ? metaMatch[1] : rest;
  const metadata = metaMatch ? metaMatch[2] : '';
  const service = message.includes('.') ? message.split('.')[0] : message.split(' ')[0];
  return { timestamp, level, message, service, metadata };
};

const readLogFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return data.split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const getLogs = async (_req, res) => {
  try {
    const lines = [...readLogFile(APP_LOG), ...readLogFile(ERROR_LOG)];
    const entries = lines
      .map(parseLogLine)
      .filter(Boolean)
      .map((entry, idx) => ({
        id: `${entry.timestamp}-${idx}`,
        timestamp: entry.timestamp,
        level: entry.level === 'WARN' || entry.level === 'ERROR' ? entry.level : 'INFO',
        service: entry.service || 'api',
        message: entry.message,
        metadata: entry.metadata || '',
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);
    return res.json(entries);
  } catch (error) {
    console.error('Logs error:', error);
    return res.status(500).json({ error: 'Erro ao carregar logs.' });
  }
};

const getAIUsage = async (_req, res) => {
  try {
    const db = connectionManager.getMaster();
    const req = _req;

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    const parseDateInput = (value) => {
      if (!value) return null;
      const parsed = new Date(`${value}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const now = new Date();
    const period = String(req.query?.period || '30d').trim().toLowerCase();
    const fromDateInput = String(req.query?.from || '').trim();
    const toDateInput = String(req.query?.to || '').trim();

    let rangeStart = null;
    let rangeEnd = null;
    let periodLabel = 'Últimos 30 dias';

    if (period === 'today') {
      rangeStart = startOfDay(now);
      rangeEnd = endOfDay(now);
      periodLabel = 'Hoje';
    } else if (period === '7d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      rangeStart = startOfDay(start);
      rangeEnd = endOfDay(now);
      periodLabel = 'Últimos 7 dias';
    } else if (period === '90d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 89);
      rangeStart = startOfDay(start);
      rangeEnd = endOfDay(now);
      periodLabel = 'Últimos 90 dias';
    } else if (period === 'month') {
      rangeStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      rangeEnd = endOfDay(now);
      periodLabel = 'Mês atual';
    } else if (period === 'custom') {
      const fromDate = parseDateInput(fromDateInput);
      const toDate = parseDateInput(toDateInput);
      if (fromDate && toDate) {
        rangeStart = startOfDay(fromDate);
        rangeEnd = endOfDay(toDate);
      } else {
        const fallback = new Date(now);
        fallback.setDate(fallback.getDate() - 29);
        rangeStart = startOfDay(fallback);
        rangeEnd = endOfDay(now);
      }
      periodLabel = 'Período personalizado';
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      rangeStart = startOfDay(start);
      rangeEnd = endOfDay(now);
      periodLabel = 'Últimos 30 dias';
    }

    if (rangeStart > rangeEnd) {
      const tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }

    const rows = await db('ai_request_logs')
      .where('created_at', '>=', rangeStart)
      .andWhere('created_at', '<=', rangeEnd)
      .orderBy('created_at', 'desc');
    const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
    const cfg = configRow?.value
      ? (typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value)
      : {};
    const customPricing = normalizePricingMap(cfg?.aiModelPricingUSDPer1M || cfg?.aiModelPricing);
    const pricingMap = { ...DEFAULT_MODEL_PRICING_USD_PER_1M, ...customPricing };

    const totalRequests = rows.length;
    const totalTokens = rows.reduce((acc, row) => acc + (row.tokens_in || 0) + (row.tokens_out || 0), 0);
    const avgLatency = totalRequests > 0
      ? Math.round(rows.reduce((acc, row) => acc + (row.latency_ms || 0), 0) / totalRequests)
      : 0;
    const totalCost = rows.reduce((acc, row) => acc + estimateCostUsd(row, pricingMap), 0);

    const dailyUsageMap = new Map();
    const dayCursor = new Date(rangeStart);
    while (dayCursor <= rangeEnd) {
      const date = new Date(dayCursor);
      const key = date.toISOString().slice(0, 10);
      dailyUsageMap.set(key, { date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), requests: 0 });
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
    rows.forEach((row) => {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      if (dailyUsageMap.has(key)) {
        dailyUsageMap.get(key).requests += 1;
      }
    });

    const providerCounts = rows.reduce((acc, row) => {
      acc[row.provider] = (acc[row.provider] || 0) + 1;
      return acc;
    }, {});
    const providerDistribution = Object.entries(providerCounts)
      .map(([provider, count]) => ({
        provider,
        percentage: totalRequests ? Math.round((count / totalRequests) * 100) : 0,
        color: provider.toLowerCase().includes('openai') ? '#6366f1' : '#10b981',
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const tokensByTenantMap = rows.reduce((acc, row) => {
      if (!row.tenant_id) return acc;
      const total = (row.tokens_in || 0) + (row.tokens_out || 0);
      acc[row.tenant_id] = (acc[row.tenant_id] || 0) + total;
      return acc;
    }, {});
    const tenantIds = Object.keys(tokensByTenantMap);
    const tenantRows = tenantIds.length > 0 ? await db('tenants').whereIn('id', tenantIds).select('id', 'name') : [];
    const tenantNameMap = tenantRows.reduce((acc, row) => {
      acc[row.id] = row.name;
      return acc;
    }, {});
    const tokensByTenant = tenantIds
      .map((tenantId) => ({
        label: tenantNameMap[tenantId] || tenantId.slice(0, 6),
        value: tokensByTenantMap[tenantId],
        percentage: totalTokens ? Math.round((tokensByTenantMap[tenantId] / totalTokens) * 100) : 0,
        color: '#6366f1',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const recentLogs = rows.slice(0, 20).map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      model: row.model,
      context: row.context,
      tokensIn: row.tokens_in || 0,
      tokensOut: row.tokens_out || 0,
      latency: row.latency_ms || 0,
    }));

    return res.json({
      totalCost30d: Number(totalCost.toFixed(6)),
      totalRequests30d: totalRequests,
      totalTokens30d: totalTokens,
      avgLatency30d: avgLatency,
      period,
      periodLabel,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      dailyUsage: Array.from(dailyUsageMap.values()),
      providerDistribution,
      tokensByTenant,
      tokensByType: [],
      recentLogs,
    });
  } catch (error) {
    console.error('AI usage error:', error);
    return res.status(500).json({ error: 'Erro ao carregar métricas de IA.' });
  }
};

module.exports = {
  getSystemHealth,
  toggleMaintenance,
  clearCache,
  getLogs,
  getAIUsage,
};
