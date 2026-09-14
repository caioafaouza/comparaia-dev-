require('dotenv').config();
const knex = require('knex');
const provisioningService = require('../services/provisioningService');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const logFile = path.join(__dirname, '..', 'test-results', 'provision_qa_tenant_output.txt');
const log = (msg) => {
    const line = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(msg);
};

// Ensure log dir
if (!fs.existsSync(path.dirname(logFile))) fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, '');

const config = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 0, max: 2, acquireTimeoutMillis: 10000 },
};

async function provisionQA() {
    const db = knex(config);
    log('=== PROVISION QA TENANT (ISOLATED) ===');

    try {
        const slug = 'qatest';
        const email = 'qa@inctec.com.br';

        log('[1/4] Checking existing tenant...');
        const existing = await db('tenants').where({ slug }).first();

        if (existing) {
            log(`  ⚠️  Tenant '${slug}' already exists (id=${existing.id})`);
            log('  Skipping provision.');
        } else {
            log('[2/4] Provisioning new tenant...');
            const result = await provisioningService.registerTenant({
                name: 'QA Test Tenant',
                email,
                slug,
                plan: 'free',
                adminName: 'QA Admin',
                password: 'qatest-password'
            }, db);

            log(`  ✅ Tenant created: ${result.slug} (${result.tenantId})`);
            log(`  ✅ DB Schema: ${result.dbName}`);
        }

        log('✅ PROVISION STEP COMPLETE');

        // VERIFICATION STEP
        log('[3/4] Running Tenant Schema Verification...');
        const verScript = path.join(__dirname, 'verify_tenant_schema.cjs');
        const res = spawnSync('node', [verScript], { stdio: 'inherit', cwd: path.dirname(verScript) });

        if (res.status !== 0) {
            throw new Error('Tenant Schema Verification Failed');
        }
        log('✅ Tenant Schema Verification PASSED');

    } catch (err) {
        log(`❌ PROVISION FAILED: ${err.message}`);
        console.error(err);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

provisionQA();
