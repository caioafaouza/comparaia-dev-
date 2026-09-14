
const http = require('http');

const req = http.get('http://localhost:3000/api/admin/config', (res) => {
    console.log('Status:', res.statusCode);
    res.on('data', d => process.stdout.write(d));
});
req.on('error', (e) => {
    console.error('API Error:', e);
});
