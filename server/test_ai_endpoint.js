
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
                'X-Tenant-ID': 'demo'
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
    console.log('--- TEST RAW ANALYSIS ---');
    try {
        const payload = {
            reference: { content: "Spec: Laptop i7 16GB RAM" },
            candidates: [
                { name: "Candidate A", data: "Base64MockData", mimeType: "application/pdf" }
            ],
            compliance: null
        };

        console.log('Sending payload...');
        const res = await request('/api/ai/analyze-raw', payload);
        console.log(`POST /api/ai/analyze-raw: ${res.status}`);
        console.log('Body:', res.body.substring(0, 200) + '...');
    } catch (e) {
        console.error('Error:', e);
    }
})();
