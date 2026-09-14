const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant } = require('./helpers/authUtils');
const { truncateMasterTables } = require('./helpers/dbUtils');
const jwt = require('jsonwebtoken');

describe('Impersonation Feature', () => {
    let masterToken;
    let targetTenantId;
    let targetUserId;
    let targetUserEmail;

    beforeAll(async () => {
        const loginRes = await loginMaster();
        masterToken = loginRes.token;
    });

    beforeEach(async () => {
        await truncateMasterTables();

        // Setup: Create a tenant and a user to impersonate
        const t = await registerTenant(masterToken, {
            name: 'Target Tenant',
            slug: 'target-tenant',
            adminName: 'Target Admin',
            email: 'target@admin.com'
        });

        targetTenantId = t.response.body.tenantId;
        targetUserEmail = t.ownerEmail;

        // We need the user ID. 
        // option A: get from DB directly
        // option B: Use admin/users list
        const resUsers = await startTestServer()
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${masterToken}`);

        const user = resUsers.body.find(u => u.email === targetUserEmail);
        targetUserId = user.id;
    });

    test('POST /api/admin/impersonate should return a valid token for the target user', async () => {
        const payload = {
            tenantId: targetTenantId,
            userId: targetUserId
        };

        const res = await startTestServer()
            .post('/api/admin/impersonate')
            .set('Authorization', `Bearer ${masterToken}`)
            .send(payload);

        if (res.status !== 200) {
            console.error('Impersonate Error:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.email).toBe(targetUserEmail);
        expect(res.body.user.id).toBe(targetUserId);
        expect(res.body.tenant.id).toBe(targetTenantId);

        // Verify Token Contents (Standard checks)
        const decoded = jwt.decode(res.body.token);
        expect(decoded.userId).toBe(targetUserId);
        expect(decoded.tenantId).toBe(targetTenantId);
        expect(decoded.isImpersonation).toBe(true);
        expect(decoded.impersonatorId).toBeDefined();
    });

    test('should fail if requester is not a platform admin', async () => {
        // Try with no token
        const res = await startTestServer()
            .post('/api/admin/impersonate')
            .send({ tenantId: targetTenantId, userId: targetUserId });

        expect(res.status).toBe(403); // or 401 depending on middleware order
    });

    test('should fail if target user does not exist', async () => {
        const res = await startTestServer()
            .post('/api/admin/impersonate')
            .set('Authorization', `Bearer ${masterToken}`)
            .send({ tenantId: targetTenantId, userId: '00000000-0000-0000-0000-000000000000' });

        expect(res.status).toBe(404);
    });

    test('should fail if target tenant does not exist', async () => {
        const res = await startTestServer()
            .post('/api/admin/impersonate')
            .set('Authorization', `Bearer ${masterToken}`)
            .send({ tenantId: '00000000-0000-0000-0000-000000000000', userId: targetUserId });

        expect(res.status).toBe(404);
    });
});
