
const http = require('http');

let currentTenantSlug = 'demo';

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': currentTenantSlug,
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    console.log('--- SYSTEM VERIFICATION SUITE ---');

    console.log('\n[1] Authentication');
    const loginRes = await request('POST', '/api/auth/login', { email: 'contato@inctec.com.br', password: 'Caio1991*' });

    if (loginRes.status !== 200) return console.error('❌ Login failed', loginRes.body);
    console.log('✅ Login OK');

    const token = JSON.parse(loginRes.body).token;
    const userId = JSON.parse(loginRes.body).user.id;

    console.log('\n[1.5] resolving Tenant Context');
    const tenantsRes = await request('GET', '/api/admin/tenants', null, token);

    if (tenantsRes.status === 200) {
        const tenants = JSON.parse(tenantsRes.body);
        if (tenants.length > 0) {
            currentTenantSlug = tenants[0].slug;
            console.log(`✅ Switched context to Tenant: ${tenants[0].name} (Slug: ${currentTenantSlug})`);
        } else {
            console.warn('⚠️ No tenants found. Using "demo". Failures expected if demo DB missing.');
        }
    } else {
        console.warn('⚠️ Failed to list tenants. Using "demo".');
    }

    console.log('\n[2] Job Management');
    console.log('   Target URL:', `/api/jobs (Tenant: ${currentTenantSlug})`);

    // CREATE
    const createRes = await request('POST', '/api/jobs', {
        referenceName: 'Test Verify Job',
        candidateCount: 1,
        userId: userId,
        cost: 10.00
    }, token);

    if (createRes.status === 200 || createRes.status === 201) {
        console.log('✅ POST /api/jobs (Create) OK');
        const createdJob = JSON.parse(createRes.body);
        const jobId = createdJob.id;

        // LIST
        const listRes = await request('GET', '/api/jobs', null, token);
        if (listRes.status === 200) console.log(`✅ GET /api/jobs (List) OK`);
        else console.error('❌ GET /api/jobs failed', listRes.body);

        // DELETE
        if (jobId) {
            const delRes = await request('DELETE', `/api/jobs/${jobId}`, null, token);
            if (delRes.status === 200) console.log('✅ DELETE /api/jobs/:id OK');
            else console.error('❌ DELETE /api/jobs/:id failed', delRes.body);
        }

    } else {
        console.error('❌ POST /api/jobs failed', createRes.body);
        // Don't crash entire script
    }

    console.log('\n[3] Dashboard Metrics');
    const metricsRes = await request('GET', '/api/dashboard/metrics', null, token);
    if (metricsRes.status === 200) {
        console.log('✅ GET /api/dashboard/metrics OK');
    } else {
        console.error('❌ GET /api/dashboard/metrics failed', metricsRes.body);
    }

    console.log('\n[4] AI Features');
    const aiRes = await request('POST', '/api/ai/compare', { productIds: [] }, token);
    console.log(`ℹ️ AI Endpoint Status: ${aiRes.status} (Accessibility Check Only)`);

})();
