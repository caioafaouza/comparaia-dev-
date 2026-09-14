const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant } = require('./helpers/authUtils');
const { truncateMasterTables } = require('./helpers/dbUtils');
const { connectionManager } = require('../db/connectionManager');

describe('Admin User Management (Global)', () => {
    let masterToken;
    let tenantId;
    let tenantUserEmail;
    let tenantUserId;

    beforeAll(async () => {
        const loginRes = await loginMaster();
        masterToken = loginRes.token;
    });

    beforeEach(async () => {
        await truncateMasterTables();

        // Register a tenant to have some users
        // This helper creates a tenant and an admin user for it
        const t = await registerTenant(masterToken, { name: 'User Test Tenant', slug: 'user-test' });
        tenantId = t.response.body.tenantId;
        tenantUserEmail = t.ownerEmail;

        // We need to fetch the user ID from the response or DB
        // The register response doesn't return the user ID directly (it returns dbName, tenantId)
        // So we might need to query the user via API or DB
        // Let's rely on GET /api/admin/users to find this user
    });

    describe('GET /api/admin/users', () => {
        test('should list users from all tenants', async () => {
            const res = await startTestServer()
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBeGreaterThan(0);

            const user = res.body.find(u => u.email === tenantUserEmail);
            expect(user).toBeDefined();
            expect(user.tenantName).toBe('User Test Tenant');

            // Store ID for next tests
            tenantUserId = user.id;
        });
    });

    describe('PATCH /api/admin/users/:id', () => {
        beforeEach(async () => {
            // Ensure we have the ID first
            const res = await startTestServer()
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${masterToken}`);
            const user = res.body.find(u => u.email === tenantUserEmail);
            tenantUserId = user.id;
        });

        test('should update user status (disable/enable)', async () => {
            // 1. Disable
            const resDisable = await startTestServer()
                .patch(`/api/admin/users/${tenantUserId}`)
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ status: 'INACTIVE' });

            expect(resDisable.status).toBe(200);
            // It might return { success: true } or the updated user
            // Controller returns { success: true, tenantId: ... }
            expect(resDisable.body.success).toBe(true);

            // Verify
            const resList = await startTestServer()
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${masterToken}`);
            const disabledUser = resList.body.find(u => u.id === tenantUserId);
            expect(disabledUser.status).toBe('INACTIVE');

            // 2. Enable
            const resEnable = await startTestServer()
                .patch(`/api/admin/users/${tenantUserId}`)
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ status: 'ACTIVE' });

            expect(resEnable.status).toBe(200);
            expect(resEnable.body.success).toBe(true);

            // Verify
            const resList2 = await startTestServer()
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${masterToken}`);
            const enabledUser = resList2.body.find(u => u.id === tenantUserId);
            expect(enabledUser.status).toBe('ACTIVE');
        });

        test('should return 404 for non-existent user', async () => {
            const res = await startTestServer()
                .patch('/api/admin/users/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ status: 'INACTIVE' });

            expect(res.status).toBe(404);
        });
    });
});
