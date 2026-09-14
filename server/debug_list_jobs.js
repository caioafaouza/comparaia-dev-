
require('dotenv').config();
const knex = require('knex');
const http = require('http');

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

async function debugListJobs() {
    console.log('--- DEBUG LIST JOBS (Demo) ---');
    const db = knex(DB_CONFIG);
    const tenantSlug = 'demo';
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;

    try {
        console.log('1. Direct DB Query...');
        const tenantDb = db.withSchema(schemaName);

        // Count
        const count = await tenantDb.table('comparison_jobs').count('* as count').first();
        console.log(`   Count Result:`, count);

        // Select
        const rows = await tenantDb.table('comparison_jobs').select('*').limit(1);
        console.log(`   Select Result: ${rows.length} rows`);
        if (rows.length > 0) console.log('   Row Sample:', rows[0]);

        console.log('✅ DB seems fine.');

    } catch (e) {
        console.error('❌ DB Query Failed:', e.message);
    } finally {
        await db.destroy();
    }

    // Now API
    console.log('\n2. API Query (GET /jobs)...');
    // We need a token. We'll login first.
    try {
        const loginRes = await req('POST', '/api/auth/login', { email: 'contato@inctec.com.br', password: '123456' }, { 'X-Tenant-ID': 'demo' });
        const token = JSON.parse(loginRes.body).token;
        console.log('   Got Token.');

        const listRes = await req('GET', '/api/jobs', null, { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': 'demo' });
        console.log(`   API Status: ${listRes.status}`);
        if (listRes.status !== 200) {
            console.log(`   API Body: ${listRes.body}`);
        }
    } catch (e) {
        console.error(e);
    }
}

// Helper
const API_CONFIG = { hostname: 'localhost', port: 3000, headers: { 'Content-Type': 'application/json' } };
function req(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = { ...API_CONFIG, method, path, headers: { ...API_CONFIG.headers, ...headers } };
        const r = http.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

debugListJobs();
