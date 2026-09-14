require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const API_CONFIG = { hostname: 'localhost', port: 3000 };
const VALIDATION_TOKEN_PATH = process.env.VALIDATION_TOKEN_PATH || '_tmp_tenant_session.json';
const VALIDATION_TENANT_SLUG = process.env.VALIDATION_TENANT_SLUG || 'MASTER';
const VALIDATION_EMAIL = process.env.VALIDATION_EMAIL || 'contato@inctec.com.br';
const VALIDATION_PASSWORD = process.env.VALIDATION_PASSWORD || 'Caio*1991';

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
        const options = { ...API_CONFIG, method, path, headers };
        const r = http.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        r.on('error', reject);

        if (body) {
            if (Buffer.isBuffer(body)) r.write(body);
            else r.write(JSON.stringify(body));
        }
        r.end();
    });
}

function createMultipartBody(fields, boundary) {
    const body = [];
    for (const [key, value] of Object.entries(fields)) {
        body.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
    }
    body.push(`--${boundary}--\r\n`);
    return Buffer.from(body.join(''));
}

(async () => {
    console.log('--- VALIDATING FULL API (LIST + CREATE) ---');

    // 1. LOGIN (Tenant Admin) or reuse cached token
    const cached = loadTokenFromFile();
    let token = cached?.token || null;
    let tenantSlug = cached?.tenant?.slug || cached?.tenant?.id || VALIDATION_TENANT_SLUG;
    let userId = cached?.user?.id || null;

    if (token) {
        console.log('1. Using cached tenant token.');
    } else {
        console.log(`1. Login (tenant: ${tenantSlug})...`);
        const headers = { 'Content-Type': 'application/json' };
        if (tenantSlug !== 'MASTER') headers['X-Tenant-ID'] = tenantSlug;

        const loginRes = await req('POST', '/api/auth/login', {
            email: VALIDATION_EMAIL,
            password: VALIDATION_PASSWORD
        }, headers);

        if (loginRes.status !== 200) {
            console.error('Login failed:', loginRes.body);
            process.exit(1);
        }
        const session = JSON.parse(loginRes.body);
        token = session.token;
        userId = session.user?.id || null;
        console.log('Login OK.');
    }

    // 2. IMPERSONATION (Find a tenant user and impersonate)
    console.log('2. Finding user to impersonate...');

    // HEADERS for Master Admin actions
    const masterHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const usersRes = await req('GET', '/api/admin/users', null, masterHeaders);

    if (usersRes.status !== 200) {
        console.error('Failed to list users:', usersRes.status);
        process.exit(1);
    }

    const allUsers = JSON.parse(usersRes.body);
    const targetUser = allUsers.find(u => u.tenantId !== 'MASTER' && u.status === 'ACTIVE');

    if (!targetUser) {
        console.error('No active tenant user found to impersonate. Cannot validate Jobs API.');
        // This is a soft fail if the environment is empty, but we expect at least one tenant from previous tests.
        process.exit(1);
    }

    console.log(`Found target user: ${targetUser.email} (Tenant: ${targetUser.tenantName})`);

    console.log('3. Impersonating...');
    const impersonateRes = await req('POST', '/api/admin/impersonate', {
        tenantId: targetUser.tenantId,
        userId: targetUser.id
    }, masterHeaders);

    if (impersonateRes.status !== 200) {
        console.error('Impersonation failed:', impersonateRes.status, impersonateRes.body);
        process.exit(1);
    }

    const impData = JSON.parse(impersonateRes.body);
    const impToken = impData.token;
    const impSlug = impData.tenant.slug;
    console.log(`Impersonation OK. Token obtained for tenant: ${impSlug}`);

    // 4. LIST JOBS (As Impersonated User)
    console.log(`4. List Jobs (GET /jobs) as ${impSlug}...`);

    const tenantHeaders = {
        'Authorization': `Bearer ${impToken}`,
        'X-Tenant-ID': impSlug
    };

    const listRes = await req('GET', '/api/jobs', null, tenantHeaders);

    if (listRes.status === 200) {
        console.log('List Jobs OK.');
    } else {
        console.error('List Jobs Failed:', listRes.status);
        try {
            console.error('Error Details:', JSON.stringify(JSON.parse(listRes.body), null, 2));
        } catch (e) { console.error('Raw Body:', listRes.body); }
    }

    // 5. CREATE JOB
    console.log('5. Create Job (POST /jobs)...');
    try {
        const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
        const bodyBuffer = createMultipartBody({
            referenceName: 'Job Teste Impersonation',
            candidateCount: '0',
            userId: targetUser.id,
            cost: '0'
        }, boundary);

        const createHeaders = {
            ...tenantHeaders,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length
        };

        const createRes = await req('POST', '/api/jobs', bodyBuffer, createHeaders);

        if (createRes.status === 200 || createRes.status === 201) {
            console.log('Create Job OK:', createRes.body);
        } else {
            console.error('Create Job Failed:', createRes.status);
            try {
                console.error('Error Details:', JSON.stringify(JSON.parse(createRes.body), null, 2));
            } catch (e) { console.error('Raw Body:', createRes.body); }
        }
    } catch (e) {
        console.error('Create Exception:', e);
    }

    // 6. METRICS (GET /dashboard/metrics)
    console.log('6. Get Metrics (GET /dashboard/metrics)...');

    const metricRes = await req('GET', '/api/dashboard/metrics', null, tenantHeaders);

    if (metricRes.status === 200) {
        console.log('Metrics OK:', metricRes.body);
    } else {
        console.error('Metrics Failed:', metricRes.status);
    }
})();
