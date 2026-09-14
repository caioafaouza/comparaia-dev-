
const { Pool } = require('pg');
// Native fetch is available in Node 18+


// Adjust these imports based on your project structure if you were importing modules
// Since we are running as a script, we might need to rely on direct DB access or API.
// Let's use direct DB for setup (Master) and API for testing.

// DB Config (Master)
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'comparaai_master', // Guessing name based on logs/previous context
    password: 'admin',
    port: 5432,
};
// We might not know the exact DB name or creds.
// Let's try to use the `connectionManager` if possible, but importing it in a standalone script might be tricky with paths.
// Easier to just use the API if we have the SuperAdmin credentials.

const API = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'contato@inctec.com.br';
const ADMIN_PASS = 'Caio1991*';

async function run() {
    try {
        // 1. Login as SuperAdmin
        console.log('1. Logging in as SuperAdmin...');
        const loginRes = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
        });

        if (!loginRes.ok) throw new Error(`SuperAdmin Login failed: ${await loginRes.text()}`);
        const adminSession = await loginRes.json();
        const adminToken = adminSession.token;
        console.log('✅ SuperAdmin Logged In.');

        // 2. List Tenants
        console.log('\n2. Fetching Tenants...');
        const tenantsRes = await fetch(`${API}/admin/tenants?page=1&limit=10`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const tenants = await tenantsRes.json();
        const tenantList = tenants.data || tenants;

        if (tenantList.length === 0) {
            console.log('❌ No tenants found. Cannot test tenant user login.');
            return;
        }

        const targetTenant = tenantList[0];
        console.log(`✅ Selected Tenant: ${targetTenant.name} (${targetTenant.slug})`);

        // 3. Create a Test User in this Tenant (if not exists)
        // We need a way to create a user. The Admin can "Create User" in Global Users or Tenant context.
        // Let's try to use the register endpoint or just assuming a user exists?
        // Better: Login as the Tenant Admin. The tenant usually has an admin created at registration.
        // But we don't know the password...
        // We can IMPERSONATE? No, we want to test REAl login.

        // Let's Create a new User via Superadmin for this tenant?
        // API: POST /api/users (needs X-Tenant-ID)
        console.log(`\n3. Creating Test User in ${targetTenant.slug}...`);
        const testEmail = `test_${Date.now()}@example.com`;
        const testPass = 'Password123!';

        const createUserRes = await fetch(`${API}/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`, // Using Admin token
                'Content-Type': 'application/json',
                'X-Tenant-ID': targetTenant.slug // Injecting into tenant
            },
            body: JSON.stringify({
                name: 'Test Looper',
                email: testEmail,
                password: testPass,
                role: 'MEMBER' // Regular user
            })
        });

        if (!createUserRes.ok) {
            console.log(`⚠️ Could not create user (maybe API mismatch): ${await createUserRes.text()}`);
            // Fallback: Try to login with known tenant admin if possible? 
            // Or maybe proceed if the user already exists (409)
        } else {
            console.log(`✅ Created user: ${testEmail}`);
        }

        // 4. Attempt to Login as the New User
        console.log(`\n4. Login as New User (${testEmail})...`);
        const userLoginRes = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': targetTenant.slug
            },
            body: JSON.stringify({ email: testEmail, password: testPass })
        });

        if (!userLoginRes.ok) {
            throw new Error(`User Login failed: ${await userLoginRes.text()}`);
        }

        const userSession = await userLoginRes.json();
        const userToken = userSession.token;
        console.log('✅ User Login Success.');

        // 5. Test Critical Endpoints (Simulating App.tsx load)
        const endpoints = [
            { url: `${API}/plans`, name: 'Get Plans' },
            { url: `${API}/billing/wallet`, name: 'Get Wallet' },
            { url: `${API}/billing/transactions`, name: 'Get Transactions' }
        ];

        for (const ep of endpoints) {
            console.log(`\n--- Testing ${ep.name} ---`);
            const res = await fetch(ep.url, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'X-Tenant-ID': targetTenant.slug // Usually sent by client
                }
            });
            console.log(`Status: ${res.status}`);
            if (!res.ok) {
                console.log(`❌ Error: ${await res.text()}`);
                if (res.status === 401 || res.status === 403) {
                    console.log('🚨 THIS IS THE CULPRIT! 401/403 triggers auto-logout.');
                }
            } else {
                console.log('✅ OK');
            }
        }

    } catch (e) {
        console.error('❌ Script Error:', e);
    }
}

run();
