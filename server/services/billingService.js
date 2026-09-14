const connectionManager = require('../db/connectionManager');
const crypto = require('crypto');

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toNumber = (value, fallback = 0) => {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPlanById = async (masterDb, planId) => {
  if (!planId) return null;
  const plan = await masterDb('token_plans').where({ id: planId }).first();
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    price: toNumber(plan.price, 0),
    currency: plan.currency || 'BRL',
    active: plan.active !== false,
    limits: safeJsonParse(plan.limits, {}),
    features: safeJsonParse(plan.features, {}),
  };
};

// New: Sum everything from ledger
const getLedgerBalance = async (masterDb, tenantId) => {
  const result = await masterDb('token_transactions')
    .sum('amount as total')
    .where({ tenant_id: tenantId })
    .where((qb) => {
      qb.whereNot({ status: 'CANCELLED' }).orWhereNull('status');
    }) // Ignore cancelled/refunded, include legacy null statuses
    .first();
  return toNumber(result?.total, 0);
};

// Deprecated (Legacy Fallback)
const getTenantTokenConsumed = async (tenantDb) => {
  if (!tenantDb) return 0;
  if (!(await tenantDb.schema.hasTable('comparison_jobs'))) return 0;
  // This is legacy. Ideally we migrate everything to Ledger.
  // For now, we return 0 and rely on Backfill script to populate Ledger.
  return 0;
};

const getTenantWalletBalance = async (tenant) => {
  const masterDb = connectionManager.getMaster();
  const plan = await getPlanById(masterDb, tenant?.plan);
  const planTokens = toNumber(plan?.limits?.monthlyTokens, 0);

  const ledgerTotal = await getLedgerBalance(masterDb, tenant.id);

  const walletRow = await masterDb('wallet')
    .where({ tenant_id: tenant.id })
    .first();

  if (walletRow) {
    return {
      balance: Math.max(0, toNumber(walletRow.balance, 0)),
      planTokens,
      ledgerTotal,
    };
  }

  // Fallback to ledger-based balance if wallet missing
  const balance = Math.max(0, planTokens + ledgerTotal);
  return { balance, planTokens, ledgerTotal };
};

const ensureWallet = async (trx, tenantId) => {
  const existing = await trx('wallet').where({ tenant_id: tenantId }).first();
  if (existing) return existing;

  const tenant = await trx('tenants').select('plan').where({ id: tenantId }).first();
  const plan = await getPlanById(trx, tenant?.plan);
  const planTokens = toNumber(plan?.limits?.monthlyTokens, 0);
  const ledgerTotal = await getLedgerBalance(trx, tenantId);
  const startingBalance = Math.max(0, planTokens + ledgerTotal);

  await trx('wallet').insert({
    tenant_id: tenantId,
    balance: startingBalance,
    updated_at: new Date(),
  });

  return { balance: startingBalance };
};

const creditTokens = async (tenantId, amount, options = {}, existingDb = null) => {
  const masterDb = connectionManager.getMaster();
  const creditAmount = Math.abs(toNumber(amount, 0));
  if (!creditAmount) return null;
  const applyCredit = async (trx) => {
    await ensureWallet(trx, tenantId);
    await trx('wallet')
      .where({ tenant_id: tenantId })
      .increment('balance', creditAmount);

    const hasRefColumn = await trx.schema.hasColumn('token_transactions', 'reference_id');
    const hasStatusColumn = await trx.schema.hasColumn('token_transactions', 'status');

    const entry = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      amount: creditAmount,
      type: options.type || 'TOKEN_REFILL',
      description: options.description || 'Cr?dito de tokens',
      created_at: new Date(),
    };

    if (hasStatusColumn) entry.status = options.status || 'CONFIRMED';
    if (hasRefColumn) entry.reference_id = options.referenceId || null;

    await trx('token_transactions').insert(entry);
    return entry;
  };

  if (existingDb) {
    return applyCredit(existingDb);
  }

  return masterDb.transaction(async (trx) => applyCredit(trx));
};

const reserveCredits = async (tenantId, amount, jobId, existingDb = null) => {
  const masterDb = existingDb || connectionManager.getMaster();

  // ATOMIC TRANSACTION: Verify balance and reserve in single DB operation
  // Note: if existingDb is a transaction instance, this works.
  // If it's a knex instance, we might want to start a transaction?
  // But usually isolated knex is for tests.

  // If existingDb is provided (e.g. isolated knex), we use it.
  // The transaction call `masterDb.transaction` should work on isolated knex too.

  return await masterDb.transaction(async (trx) => {
    await ensureWallet(trx, tenantId);
    // Step 1: Atomically check balance and decrement wallet
    // This prevents race condition by using WHERE clause
    const [walletResult] = await trx('wallet')
      .where({ tenant_id: tenantId })
      .andWhere('balance', '>=', Math.abs(amount))  // Ensure sufficient balance
      .decrement('balance', Math.abs(amount))
      .returning('*');

    // Step 2: If no rows updated, balance was insufficient
    if (!walletResult) {
      throw new Error('INSUFFICIENT_TOKENS: Saldo insuficiente para reserva');
    }

    // Step 3: Create transaction record (only if wallet update succeeded)
    await trx('token_transactions').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      amount: -Math.abs(amount), // Negative for debit
      type: 'TOKEN_RESERVE',
      reference_id: jobId,
      status: 'RESERVED',
      description: `Reserva para Job ${jobId}`,
      created_at: new Date()
    });

    return walletResult;
  });
};

const captureCredits = async (jobId, existingDb = null) => {
  const masterDb = existingDb || connectionManager.getMaster();
  await masterDb('token_transactions')
    .where({ reference_id: jobId, status: 'RESERVED' })
    .update({ status: 'CONFIRMED', type: 'TOKEN_USAGE' });
};

const refundCredits = async (jobId, existingDb = null) => {
  const masterDb = existingDb || connectionManager.getMaster();

  await masterDb.transaction(async (trx) => {
    const txs = await trx('token_transactions')
      .where({ reference_id: jobId })
      .where((qb) => qb.whereNot({ status: 'CANCELLED' }).orWhereNull('status'));

    if (txs.length === 0) return;

    const tenantId = txs[0].tenant_id;
    const total = txs.reduce((sum, tx) => sum + toNumber(tx.amount, 0), 0);

    if (total < 0) {
      await ensureWallet(trx, tenantId);
      await trx('wallet')
        .where({ tenant_id: tenantId })
        .increment('balance', Math.abs(total));
    }

    // Mark as CANCELLED (excludes from sum)
    await trx('token_transactions')
      .where({ reference_id: jobId })
      .update({ status: 'CANCELLED', type: 'TOKEN_REFUND' });
  });
};

module.exports = {
  safeJsonParse,
  toNumber,
  getPlanById,
  getTenantWalletBalance,
  reserveCredits,
  captureCredits,
  refundCredits,
  creditTokens
};
