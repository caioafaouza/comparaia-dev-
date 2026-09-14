
const http = require('http');

function request(path, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': 'inctec-sistemas' // Valid tenant from system validation
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    console.log('--- TEST JOB CREATION (Tenant: inctec-sistemas) ---');
    try {
        const payload = {
            userId: '00000000-0000-0000-0000-000000000000', // Random ID to trigger auto-provisioning
            referenceName: 'Test Job Fixed',
            candidateCount: 2,
            cost: 10
        };

        console.log('Sending payload...');
        const res = await request('/api/jobs', payload);
        console.log(`POST /api/jobs: ${res.status}`);
        console.log('Body:', res.body);
    } catch (e) {
        console.error('Error:', e);
    }
})();
