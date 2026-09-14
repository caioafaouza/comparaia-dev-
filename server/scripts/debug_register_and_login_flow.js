
const API = 'http://localhost:3000/api';

async function run() {
    console.log('--- Debug Register & Login Flow ---');
    const timestamp = Date.now();
    const companyName = `Script Corp ${timestamp}`;
    const email = `owner_${timestamp}@test.com`;
    const password = 'Password123!';

    // 1. Register
    console.log(`\n1. Registering ${companyName}...`);
    const registerPayload = {
        name: companyName,
        email: email,
        slug: `script-corp-${timestamp}`, // Manual slug gen to match frontend roughly
        adminName: 'Owner User',
        password: password
    };

    try {
        const regRes = await fetch(`${API}/register-tenant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerPayload)
        });

        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);

        console.log('✅ Registration Success:', regData);
        // Expect: { success: true, tenantId, dbName, slug, initialPassword }
        const tenantSlug = regData.slug;
        const tenantId = regData.tenantId;

        // 2. Login
        console.log(`\n2. Logging in as ${email} (Slug: ${tenantSlug})...`);
        const loginRes = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': tenantSlug
            },
            body: JSON.stringify({ email, password })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);

        console.log('✅ Login Success.');
        const token = loginData.token;
        const sessionTenant = loginData.tenant;

        console.log('Session Tenant Slug:', sessionTenant.slug);

        if (!sessionTenant.slug) {
            console.error('🚨 ALARM: Login response is missing tenant slug! This is the bug.');
        }

        // 3. Access Protected Route (/api/plans)
        console.log(`\n3. Accessing /plans with X-Tenant-ID: ${sessionTenant.slug}`);

        const plansRes = await fetch(`${API}/plans`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': sessionTenant.slug
            }
        });

        if (plansRes.ok) {
            console.log('✅ /plans access successful.');
        } else {
            console.log(`❌ /plans failed: ${plansRes.status} ${plansRes.statusText}`);
            console.log(await plansRes.text());
        }

        // 4. Access Protected Route WITHOUT explicit header (simulating API failure case)
        // If frontend fails to send header, does it work? 
        // No, because tenantResolver needs it. But wait, can it resolve from token?
        console.log(`\n4. Accessing /plans WITHOUT X-Tenant-ID...`);
        const noHeaderRes = await fetch(`${API}/plans`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (noHeaderRes.ok) {
            console.log('✅ /plans (no header) access successful.');
        } else {
            console.log(`❌ /plans (no header) failed: ${noHeaderRes.status} ${noHeaderRes.statusText}`);
            console.log('[Info] This confirms failure if header is missing.');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
