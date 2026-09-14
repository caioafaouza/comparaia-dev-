const { startTestServer } = require('./helpers/testServer');
const { loginMaster, registerTenant } = require('./helpers/authUtils');
const { truncateMasterTables } = require('./helpers/dbUtils');
const { connectionManager } = require('../db/connectionManager');

describe('Admin Tenant Management', () => {
    let masterToken;

    beforeAll(async () => {
        const loginRes = await loginMaster();
        masterToken = loginRes.token;
    });

    beforeEach(async () => {
        await truncateMasterTables();
    });

    describe('GET /api/admin/tenants', () => {
        test('should return empty list initially', async () => {
            const res = await startTestServer()
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body).toHaveLength(0);
        });

        test('should return list of registered tenants', async () => {
            await registerTenant(masterToken, { name: 'Tenant A', slug: 'tenant-a' });
            await registerTenant(masterToken, { name: 'Tenant B', slug: 'tenant-b' });

            const res = await startTestServer()
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            const slugs = res.body.map(t => t.slug).sort();
            expect(slugs).toEqual(['tenant-a', 'tenant-b']);
        });
    });

    describe('POST /api/register-tenant', () => {
        test('should register a new tenant successfully', async () => {
            const payload = {
                name: 'New Tenant',
                email: 'new@tenant.com',
                password: 'password123',
                slug: 'new-tenant',
                plan: 'PRO'
            };

            const res = await startTestServer()
                .post('/api/register-tenant')
                .set('Authorization', `Bearer ${masterToken}`)
                .send(payload);

            if (res.status !== 201) {
                console.error('Register Tenant Error:', res.body);
            }

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('tenantId');
            expect(res.body.slug).toBe(payload.slug);
        });

        test('should fail if slug is already taken', async () => {
            await registerTenant(masterToken, { name: 'Original', slug: 'duplicate' });

            const payload = {
                name: 'Copy',
                email: 'copy@tenant.com',
                password: 'password123',
                slug: 'duplicate',
                plan: 'STARTER'
            };

            const res = await startTestServer()
                .post('/api/register-tenant')
                .set('Authorization', `Bearer ${masterToken}`)
                .send(payload);

            expect(res.status).toBe(400); // or 409 depending on implementation
            expect(res.body.error).toMatch(/slug|já existe|taken/i);
        });
    });

    describe('PATCH /api/admin/tenants/:id', () => {
        let tenantId;

        beforeEach(async () => {
            const t = await registerTenant(masterToken, { name: 'To Update', slug: 'update-me' });
            // authUtils returns { response: res, ... }
            // provisioningService returns { tenantId, ... } in res.body
            tenantId = t.response.body.tenantId;
        });

        test('should update tenant details', async () => {
            const updates = {
                name: 'Updated Name',
                plan: 'ENTERPRISE',
                status: 'SUSPENDED'
            };

            const res = await startTestServer()
                .patch(`/api/admin/tenants/${tenantId}`)
                .set('Authorization', `Bearer ${masterToken}`)
                .send(updates);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe(updates.name);
            expect(res.body.plan).toBe(updates.plan);
            expect(res.body.status).toBe(updates.status);

            // Verify in DB
            const resList = await startTestServer()
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${masterToken}`);
            const updatedTenant = resList.body.find(t => t.id === tenantId);
            expect(updatedTenant.name).toBe(updates.name);
            expect(updatedTenant.status).toBe(updates.status);
        });

        test('should return 404 for non-existent tenant', async () => {
            const res = await startTestServer()
                .patch('/api/admin/tenants/00000000-0000-0000-0000-000000000000') // UUID format
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404); // Assuming 404 for not found
        });
    });

    describe('DELETE /api/admin/tenants/:id', () => {
        let tenantId;

        beforeEach(async () => {
            const t = await registerTenant(masterToken, { name: 'To Delete', slug: 'delete-me' });
            tenantId = t.response.body.tenantId;
        });

        test('should delete tenant and its schema', async () => {
            const res = await startTestServer()
                .delete(`/api/admin/tenants/${tenantId}`)
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);

            // Verify list is empty
            const resList = await startTestServer()
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${masterToken}`);
            // Filter out to make sure (though beforeEach truncates)
            const deletedHelper = resList.body.find(t => t.id === tenantId);
            expect(deletedHelper).toBeUndefined();
        });
    });
});
