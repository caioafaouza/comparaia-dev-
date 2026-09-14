const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant } = require('./helpers/authUtils');
const { truncateMasterTables } = require('./helpers/dbUtils');

describe('Admin Overview', () => {
    let masterToken;

    beforeAll(async () => {
        const loginRes = await loginMaster();
        masterToken = loginRes.token;
    });

    beforeEach(async () => {
        // Ensure clean state (tenants, etc.)
        await truncateMasterTables();
    });

    test('overview.render.empty', async () => {
        const res = await startTestServer()
            .get('/api/admin/overview')
            .set('Authorization', `Bearer ${masterToken}`);

        if (res.status !== 200) {
            console.error('Overview Error:', res.status, res.text);
        }

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalTenants', 0);
        expect(res.body).toHaveProperty('tenants');
        expect(res.body.tenants).toBeInstanceOf(Array);
        expect(res.body.tenants).toHaveLength(0);
    });

    test('overview.render.with_data', async () => {
        // Create 2 tenants
        await registerTenant(masterToken, { name: 'T1' });
        await registerTenant(masterToken, { name: 'T2' });

        const res = await startTestServer()
            .get('/api/admin/overview')
            .set('Authorization', `Bearer ${masterToken}`)
            .expect(200);

        expect(res.body).toHaveProperty('totalTenants', 2);
        expect(res.body.tenants).toHaveLength(2);
        expect(res.body.tenants[0]).toHaveProperty('slug');
    });

    test('overview.error.retry', async () => {
        // Simulate error by sending invalid token
        await startTestServer()
            .get('/api/admin/overview')
            .set('Authorization', 'Bearer invalid_token')
            .expect(401); // Or 403
    });
});
