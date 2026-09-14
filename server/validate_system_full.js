
require('dotenv').config();
const knex = require('knex');
const http = require('http');
const fs = require('fs');

// --- CONFIG ---
const API_URL = 'http://localhost:3000';
const VALIDATION_TENANT_SLUG = process.env.VALIDATION_TENANT_SLUG;
const VALIDATION_TOKEN_PATH = process.env.VALIDATION_TOKEN_PATH || '_tmp_tenant_session.json';
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

const EXPECTED_SCHEMA = {
    users: ['id', 'name', 'email', 'password', 'role', 'status'],
    products: ['id', 'name', 'category', 'initial_cost', 'stock_quantity', 'min_stock', 'technical_specs'],
    comparison_jobs: ['id', 'user_id', 'reference_name', 'status', 'candidate_count', 'cost', 'result', 'error_message', 'created_at', 'completed_at'],
    stock_movements: ['id', 'product_id', 'type', 'quantity', 'unit_cost', 'created_at']
};

const LOG_FILE = 'full_validation_report.txt';
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
};

let resolvedTenantSlug = VALIDATION_TENANT_SLUG || null;

function loadTokenFromFile() {
    if (!fs.existsSync(VALIDATION_TOKEN_PATH)) return null;
    try {
        const raw = fs.readFileSync(VALIDATION_TOKEN_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && parsed.token ? parsed.token : null;
    } catch (e) {
        return null;
    }
}

async function resolveTenantFromDb(db) {
    if (resolvedTenantSlug) return;
    const tenant = await db('tenants').where({ status: 'ACTIVE' }).first();
    if (tenant) {
        resolvedTenantSlug = tenant.slug;
    }
}

async function validateDatabase() {
    log('--- DATABASE VALIDATION ---');
    const db = knex(DB_CONFIG);
    try {
        const tenants = await db('tenants').select('*');
        log(`Found ${tenants.length} tenants.`);

        await resolveTenantFromDb(db);

        for (const tenant of tenants) {
            log(`\nChecking Tenant: ${tenant.slug}`);
            const schemaName = tenant.db_name || `tenant_${tenant.slug.replace(/-/g, '_')}`;

            // Check Tables
            const res = await db.raw(`SELECT table_name FROM information_schema.tables WHERE table_schema = ?`, [schemaName]);
            const tables = res.rows.map(r => r.table_name);

            const missingTables = Object.keys(EXPECTED_SCHEMA).filter(t => !tables.includes(t));

            if (missingTables.length > 0) {
                log(`❌ MISSING TABLES: ${missingTables.join(', ')}`);
                // Generate Fix (SQL)
                log(`   >>> FIX REQUIRED: Run migrations for this tenant.`);
            } else {
                log(`✅ All tables present.`);

                // Check Columns
                for (const table of Object.keys(EXPECTED_SCHEMA)) {
                    const colsRes = await db.raw(`SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`, [schemaName, table]);
                    const existingCols = colsRes.rows.map(c => c.column_name);
                    const missingCols = EXPECTED_SCHEMA[table].filter(c => !existingCols.includes(c));

                    if (missingCols.length > 0) {
                        log(`   ❌ Table '${table}' missing columns: ${missingCols.join(', ')}`);
                    } else {
                        // log(`   ✅ Table '${table}' structure OK.`);
                    }
                }
            }
        }
    } catch (err) {
        log(`❌ Database Connection Error: ${err.message}`);
    } finally {
        await db.destroy();
    }
}

async function validateAPI() {
    log('\n--- API VALIDATION ---');

    if (!resolvedTenantSlug) {
        log('⚠️ No active tenant resolved. Skipping API validation.');
        return;
    }

    const token = loadTokenFromFile();
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    // Helper for requests
    const req = (method, path, body = null) => new Promise(resolve => {
        const opts = {
            hostname: 'localhost', port: 3000, path: `/api${path}`, method,
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': resolvedTenantSlug,
                ...authHeader,
            },
        };
        const r = http.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        r.on('error', e => resolve({ status: 'ERR', body: e.message }));
        if (body) r.write(JSON.stringify(body));
        r.end();
    });

    // 1. Check List Jobs (GET)
    const listRes = await req('GET', '/jobs');
    if (listRes.status === 200) log('✅ GET /jobs: OK');
    else log(`❌ GET /jobs: Failed (${listRes.status}) - ${listRes.body}`);

    // 2. Check Route Methods (PATCH vs PUT check)
    // We expect PATCH to work. PUT might fail 404 if not defined.
    const fakeJobId = '00000000-0000-0000-0000-000000000000';
    const patchRes = await req('PATCH', `/jobs/${fakeJobId}`, { status: 'TEST' });

    if (patchRes.status === 404 && patchRes.body.includes('Not Found')) {
        // Could be 404 because job doesn't exist (handled by controller) OR 404 because route doesn't exist.
        // If controller handles it, it usually returns JSON with "Job not found".
        // If express route missing, it returns generic HTML "Cannot PATCH ...".
        if (patchRes.body.includes('Cannot')) {
            log('❌ PATCH /jobs/:id: Route NOT DEFINED.');
        } else {
            log('✅ PATCH /jobs/:id: Route exists (returned Logic 404).');
        }
    } else if (patchRes.status === 500) {
        log('⚠️ PATCH /jobs/:id: Server Error (Route likely exists but data invalid).');
    } else {
        log(`ℹ️ PATCH /jobs/:id Status: ${patchRes.status}`);
    }

    const putRes = await req('PUT', `/jobs/${fakeJobId}`, { status: 'TEST' });
    if (putRes.body.includes('Cannot PUT')) {
        log('ℹ️ PUT /jobs/:id: Route NOT DEFINED (Matches findings).');
    } else {
        log('✅ PUT /jobs/:id: Route exists.');
    }
}

(async () => {
    await validateDatabase();
    await validateAPI();
    log('\nVALIDATION COMPLETE.');
})();
