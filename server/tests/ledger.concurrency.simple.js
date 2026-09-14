// Ledger Concurrency Test - Automated Gate for Production
// Validates atomic balance check + reserve under parallel load
// Run: node server/tests/ledger.concurrency.simple.js (or npm run test:ledger)

const path = require('path');
const fs = require('fs');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

// Logger
const logFile = path.join(__dirname, '..', 'test-results', 'ledger_output.txt');
const log = (msg) => {
    // Only log string messages to file, console.log might take objects
    if (typeof msg === 'string') {
        fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`);
    } else {
        fs.appendFileSync(logFile, `${new Date().toISOString()} - [Object]\n`);
    }
    console.log(msg);
};
if (!fs.existsSync(path.dirname(logFile))) fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, '');

const crypto = require('crypto');
const knex = require('knex'); // Isolated knex
const billingService = require('../services/billingService');

const TEST_TENANT_SLUG = 'qatest';  // Use the tenant we just provisioned
const INITIAL_BALANCE = 20;
const JOB_COST = 10;
const PARALLEL_REQUESTS = 3;

async function main() {
    log('\n=== LEDGER CONCURRENCY TEST (ISOLATED) ===\n');

    // Config identical to successful provision script
    const db = knex({
        client: 'pg',
        connection: {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,
            statement_timeout: 15000,
        },
        pool: { min: 0, max: 10 }, // Allow parallel queries
        searchPath: ['public'],
    });

    try {
        // 1. Get test tenant
        log('[1/5] Loading tenant...');
        const tenant = await db('tenants').where({ slug: TEST_TENANT_SLUG }).first();

        if (!tenant) {
            log(`❌ Tenant '${TEST_TENANT_SLUG}' not found. Run provision script first.`);
            await db.destroy();
            process.exit(1);
        }

        log(`  Tenant: ${tenant.name} (${tenant.id})\n`);

        // 2. Reset wallet balance
        log('[2/5] Resetting wallet...');
        let wallet = await db('wallet').where({ tenant_id: tenant.id }).first();

        if (!wallet) {
            await db('wallet').insert({
                id: crypto.randomUUID(),
                tenant_id: tenant.id,
                balance: INITIAL_BALANCE,
                created_at: new Date()
            });
            log(`  Created wallet: balance=${INITIAL_BALANCE}`);
        } else {
            await db('wallet').where({ tenant_id: tenant.id }).update({ balance: INITIAL_BALANCE });
            log(`  Reset wallet: balance=${INITIAL_BALANCE}`);
        }

        // 3. Clear old transactions
        log('[3/5] Clearing old transactions...');
        await db('token_transactions').where({ tenant_id: tenant.id }).del();
        log('  Cleared\n');

        // 4. Simulate 3 parallel reserve attempts
        log('[4/5] Simulating 3 parallel reserveCredits calls...\n');

        const jobIds = [
            crypto.randomUUID(),
            crypto.randomUUID(),
            crypto.randomUUID()
        ];

        // INJECT THE ISOLATED DB into reserveCredits
        const requests = jobIds.map(jobId =>
            billingService.reserveCredits(tenant.id, JOB_COST, jobId, db)
                .then(() => ({ jobId, status: 'SUCCESS' }))
                .catch(err => ({ jobId, status: 'FAILED', error: err.message }))
        );

        const start = Date.now();
        const results = await Promise.allSettled(requests);
        const elapsed = Date.now() - start;

        log(`  Completed in ${elapsed}ms\n`);

        // 5. Analyze results
        log('[5/5] Analyzing results...\n');

        const outcomes = results.map(r => r.value || r.reason);
        const successes = outcomes.filter(o => o.status === 'SUCCESS');
        const failures = outcomes.filter(o => o.status === 'FAILED');

        log('--- Outcomes ---');
        outcomes.forEach((outcome, i) => {
            const icon = outcome.status === 'SUCCESS' ? '✅' : '❌';
            log(`${icon} [${i}] ${outcome.status}: jobId=${outcome.jobId.substring(0, 8)}, error=${outcome.error || 'none'}`);
        });

        log(`\nSuccesses: ${successes.length}`);
        log(`Failures: ${failures.length}\n`);

        // 6. Validate database state
        log('--- Database Validation ---\n');

        wallet = await db('wallet').where({ tenant_id: tenant.id }).first();
        log(`  Final balance: ${wallet.balance}`);

        const transactions = await db('token_transactions')
            .where({ tenant_id: tenant.id })
            .orderBy('created_at', 'desc');

        log(`  Total transactions: ${transactions.length}`);

        const reserved = transactions.filter(t => t.status === 'RESERVED');
        const referenceIds = new Set(reserved.map(t => t.reference_id));

        log(`  RESERVED count: ${reserved.length}`);
        log(`  Unique reference_ids: ${referenceIds.size}\n`);

        // 7. Assertions
        log('\n--- Assertions ---\n');

        let passed = 0;
        let failed = 0;

        const check = (condition, description) => {
            if (condition) {
                log(`✅ PASS: ${description}`);
                passed++;
            } else {
                log(`❌ FAIL: ${description}`);
                failed++;
            }
        };

        check(successes.length === 2, `Exactly 2 successes (got ${successes.length})`);
        check(failures.length === 1, `Exactly 1 failure (got ${failures.length})`);
        check(Number(wallet.balance) === 0, `Final balance is 0 (got ${wallet.balance})`);
        check(Number(wallet.balance) >= 0, `Balance never negative (got ${wallet.balance})`);
        check(reserved.length === 2, `Exactly 2 RESERVED transactions (got ${reserved.length})`);

        log(`\n--- Result: ${passed} PASS, ${failed} FAIL ---\n`);

        await db.destroy();

        if (failed > 0) {
            log('❌ TEST FAILED - Ledger atomicity broken!\n');
            process.exit(1);
        } else {
            log('✅ TEST PASSED - Ledger is atomic!\n');
            process.exit(0);
        }

    } catch (err) {
        log(`\n❌ Fatal error: ${err.message}`);
        console.error(err.stack);
        await db.destroy();
        process.exit(1);
    }
}

main();
