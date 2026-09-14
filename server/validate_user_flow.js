require('dotenv').config();
const http = require('http');
const fs = require('fs');

const API_CONFIG = { hostname: 'localhost', port: 3000, headers: { 'Content-Type': 'application/json' } };
const VALIDATION_TOKEN_PATH = process.env.VALIDATION_TOKEN_PATH || '_tmp_tenant_session.json';
const VALIDATION_TENANT_SLUG = process.env.VALIDATION_TENANT_SLUG || 'demo';
const VALIDATION_EMAIL = process.env.VALIDATION_EMAIL || 'contato@inctec.com.br';
const VALIDATION_PASSWORD = process.env.VALIDATION_PASSWORD || '123456';

function loadTokenFromFile() {
    if (!fs.existsSync(VALIDATION_TOKEN_PATH)) return null;
    try {
        const raw = fs.readFileSync(VALIDATION_TOKEN_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed?.token) return null;
        return parsed;
    } catch {
        return null;
    }
}

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

(async () => {
    console.log('--- VALIDATING USER FLOW ---');

    const cached = loadTokenFromFile();
    let token = cached?.token || null;
    let tenantId = cached?.tenant?.slug || cached?.tenant?.id || VALIDATION_TENANT_SLUG;

    if (!token) {
        console.log(`1. Attempting Login (Tenant: ${tenantId})...`);
        const loginRes = await req('POST', '/api/auth/login', {
            email: VALIDATION_EMAIL,
            password: VALIDATION_PASSWORD
        }, { 'X-Tenant-ID': tenantId });

        if (loginRes.status !== 200) {
            console.error('Login Failed:', loginRes.body);
            process.exit(1);
        }

        const session = JSON.parse(loginRes.body);
        token = session.token;
        tenantId = session.tenant?.slug || session.tenant?.id || tenantId;
        console.log(`Login Success! Token obtained for Tenant: ${tenantId}`);
    } else {
        console.log('1. Using cached tenant token.');
    }

    // VERIFY AUTH
    console.log('2. Verifying Auth via GET /jobs...');
    const listRes = await req('GET', '/api/jobs', null, {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
    });

    if (listRes.status === 200) {
        console.log(`GET /jobs Success! Auth is working. Status: ${listRes.status}`);
    } else {
        console.error(`GET /jobs Failed: ${listRes.status} - ${listRes.body}`);
    }

    console.log('\n--- FLOW COMPLETE ---');
})();
