
require('dotenv').config();
const knex = require('knex');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const API_URL = 'http://localhost:3000';
const DB_CONFIG = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
};

const LOG_FILE = 'audit_report.log';

// Clear previous log
if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
}

const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
};

async function checkDBSchema() {
    log('--- 1. DATABASE SCHEMA AUDIT ---');
    const db = knex(DB_CONFIG);
    try {
        await db.raw('SELECT 1');
        log('✅ Master DB Connection: OK');

        // Check Tenants
        const tenants = await db('tenants').select('*');
        log(`ℹ️ Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            log(`Checking Tenant: ${tenant.name} (${tenant.slug})`);

            // CONNECT TO TENANT DB (Simulated by changing schema search path if using schemas, or separate DB)
            // Assuming simplified single-DB schema separation for this audit script context, 
            // verifying the tables exist in the logical flow.
            // *NOTE*: The app uses `tenant_${slug}` schema. 

            const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;
            // Simple query to list tables in schema
            const res = await db.raw(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = ?
            `, [schemaName]);

            const tables = res.rows.map(r => r.table_name);
            log(`   Tables found: ${tables.join(', ')}`);

            const expected = ['users', 'comparison_jobs', 'products'];
            const missing = expected.filter(t => !tables.includes(t));

            if (missing.length > 0) {
                log(`   ❌ MISSING TABLES: ${missing.join(', ')}`);
            } else {
                log('   ✅ Table Structure: OK');

                // DEEP DIVE: Check columns in 'comparison_jobs'
                const cols = await db.raw(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = ? AND table_name = 'comparison_jobs'
                `, [schemaName]);

                const colNames = cols.rows.map(c => c.column_name);
                log(`   comparison_jobs columns: ${colNames.join(', ')}`);

                // Check specifically for 'status', 'result', 'created_at'
                if (!colNames.includes('result')) log('   ❌ MISSING COLUMN: result');
                if (!colNames.includes('status')) log('   ❌ MISSING COLUMN: status');
            }
        }

    } catch (e) {
        log(`❌ Database Error: ${e.message}`);
    } finally {
        await db.destroy();
    }
}

async function checkFrontendCode() {
    log('\n--- 2. FRONTEND CODE AUDIT ---');
    const servicesPath = path.join(__dirname, '../services/mockBackend.ts');

    if (fs.existsSync(servicesPath)) {
        const content = fs.readFileSync(servicesPath, 'utf8');
        if (content.includes('http://localhost:3000')) {
            log('⚠️ OPTIMIZATION WARNING: Hardcoded "localhost:3000" found in frontend services.');
            log('   Recommendation: Use relative paths "/api/..." and configure Proxy strictly.');
        } else {
            log('✅ Frontend Service URL: OK (Relative paths used)');
        }
    } else {
        log('❌ Frontend services file not found for audit.');
    }
}

async function triggerApiError() {
    log('\n--- 3. API ERROR REPRODUCTION (Jobs List) ---');
    // We need to simulate a request with the Tenant Header
    const tenantSlug = 'inctec-sistemas'; // Assumed from previous context

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/jobs?page=1&limit=10',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantSlug
        }
    };

    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                log(`API Response Status: ${res.statusCode}`);
                if (res.statusCode === 500) {
                    log('❌ 500 ERROR REPRODUCED.');
                    log(`   Body: ${data}`);
                } else {
                    log('✅ API seems healthy (or error not reproduced).');
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            log(`❌ Request Failed (Backend might be down): ${e.message}`);
            resolve();
        });
        req.end();
    });
}

(async () => {
    log('STARTING SYSTEM AUDIT...');
    await checkDBSchema();
    await checkFrontendCode();
    await triggerApiError();
    log('AUDIT COMPLETE.');
})();
