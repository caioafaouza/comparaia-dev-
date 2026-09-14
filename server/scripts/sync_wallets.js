
const { Client } = require('pg');
const env = require('../config/env');

const client = new Client({
    connectionString: process.env.DATABASE_URL || `postgresql://${env.db.user}:${env.db.password}@${env.db.host}:${env.db.port}/${env.db.database}`,
    ssl: env.db.ssl
});

async function syncWallets() {
    try {
        await client.connect();
        console.log('Syncing Wallets from Ledger...');

        // 1. Get all tenants
        const tenants = await client.query('SELECT id, plan FROM tenants');

        for (const tenant of tenants.rows) {
            console.log(`Processing Tenant: ${tenant.id} (${tenant.plan})`);

            // 2. Calculate Ledger Total
            const resSum = await client.query(
                "SELECT SUM(amount) as total FROM token_transactions WHERE tenant_id = $1 AND status != 'CANCELLED'",
                [tenant.id]
            );
            const ledgerTotal = Number(resSum.rows[0].total) || 0;

            // 3. Get Plan Limits (Manual Mapping or Query)
            // Ideally query token_plans, but for speed/robustness:
            let planTokens = 0;
            if (tenant.plan === 'STARTER') planTokens = 100;
            if (tenant.plan === 'PRO') planTokens = 5000;
            if (tenant.plan === 'ENTERPRISE') planTokens = 99999;

            // Look up real plan if possible
            const planRes = await client.query('SELECT limits FROM token_plans WHERE id = $1', [tenant.plan]);
            if (planRes.rows.length > 0) {
                const limits = planRes.rows[0].limits;
                // Handle string/object limits
                const parsed = typeof limits === 'string' ? JSON.parse(limits) : limits;
                planTokens = Number(parsed?.monthlyTokens || planTokens);
            }

            // 4. Calculate Effective Balance
            // Logic from billingService.getTenantWalletBalance
            // But wait... reserveCredits uses 'wallet' table.
            // Does 'wallet' table represent CURRENT AVAILABLE BALANCE? Yes.
            // So Balance = Plan + Ledger?
            // Yes.
            const newBalance = Math.max(0, planTokens + ledgerTotal);

            // 5. Upsert Wallet
            await client.query(`
        INSERT INTO wallet (tenant_id, balance, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (tenant_id)
        DO UPDATE SET balance = $2, updated_at = NOW()
      `, [tenant.id, newBalance]);

            console.log(`-> Updated Wallet: ${newBalance} (Plan: ${planTokens} + Ledger: ${ledgerTotal})`);
        }

        console.log('Sync Complete.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

syncWallets();
