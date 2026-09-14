
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/jobs?page=1&limit=10&status=&search=',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3NzBkMGNlMC1iZTgzLTQ4NWQtOWY2NC0yZGU0MmNlYjk5NTgiLCJlbWFpbCI6ImNvbnRhdG9AaW5jdGVjLmNvbS5iciIsInJvbGUiOiJQTEFURk9STV9BRE1JTiIsInRlbmFudElkIjoiTUFTVEVSIiwiaWF0IjoxNzY5NTM4NTU4LCJleHAiOjE3Njk2MjQ5NTh9.lcQSN6QoUibEYC6V9jwDUWzH2Hm9AAAkxRAcTZveIy4',
        'X-Tenant-ID': 'demo',
        'Content-Type': 'application/json'
    }
};

const fs = require('fs');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        console.log('Writing output to error_output.txt');
        fs.writeFileSync('error_output.txt', `STATUS: ${res.statusCode}\nBODY: ${body}`);
    });
});

req.on('error', (e) => {
    fs.writeFileSync('error_output.txt', `ERROR: ${e.message}`);
    console.error(`problem with request: ${e.message}`);
});

req.end();
