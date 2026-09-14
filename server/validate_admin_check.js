
require('dotenv').config();
const http = require('http');

const API_CONFIG = { hostname: 'localhost', port: 3000 };

function req(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = { ...API_CONFIG, method, path, headers };
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
    console.log('--- ADMIN FLOW VALIDATION ---');

    // 1. LOGIN SUPER ADMIN
    console.log('1. Login Super Admin...');
    const loginRes = await req('POST', '/api/auth/login', {
        email: 'contato@inctec.com.br',
        password: 'Caio1991*'
    }, { 'Content-Type': 'application/json' });
    // Note: X-Tenant-ID might be optional for platform admin login depending on implementation, 
    // but usually Platform Admin logs in without specific tenant or a "master" tenant context.
    // Based on `authController`, it checks `req.tenantConnection`. 
    // If we don't send X-Tenant-ID, `tenantResolver` might fail or default.
    // Let's try sending 'demo' or check if there is a header for master.
    // Actually, `tenantResolver` likely requires X-Tenant-ID.
    // BUT Super Admin exists in GLOBAL users (public schema).
    // Let's try without header first, if fails, use 'demo' but expect platform role.

    // Correction: The system seems designed to have a "Master" context or similar.
    // The `authController.login` uses `req.tenantConnection('users')`.
    // If we want to log in as Super Admin, we should probably target the tenant that *has* the super admin.
    // Reset script put Super Admin in `public.users`.
    // Tenant Resolver logic usually: if no header, maybe error?
    // Let's assume we need to hit the "Management" or "Admin" portal which might use a specific tenant ID or the code handles "no tenant" as "master".

    // Retry with 'demo' as context if 'public' context isn't explicit?
    // Wait, checking `users` migration:
    // Master migrations create `users` in public schema.
    // Tenant migrations create `users` in tenant schema.
    // If I log in as Super Admin, I must validate against `public.users`.
    // Does `tenantResolver` switch to public if ID is missing?

    // Let's look at `tenantResolver.js` later if this fails. 
    // For now, I'll assume I need to indicate I'm accessing the "Platform".
    // I'll try sending X-Tenant-ID: 'master' or (undefined).

    if (loginRes.status !== 200) {
        console.log('   ⚠️ Login without tenant failed (expected if multi-tenant strict). Trying with X-Tenant-ID...');
    } else {
        console.log('   ✅ Login without Tenant ID worked.');
    }
})();
