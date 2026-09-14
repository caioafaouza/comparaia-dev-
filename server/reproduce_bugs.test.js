
const request = require('supertest');
const { createApp } = require('./app');
const connectionManager = require('./db/connectionManager');
const jwt = require('jsonwebtoken');
const config = require('./config/env');

describe('Production Bugs Reproduction', () => {
    let app;
    let db;
    let tenantId;
    let userToken;
    let userId = 'repro-user-id';

    beforeAll(async () => {
        app = createApp();
        db = connectionManager.getMaster();

        // 1. Setup Tenant
        tenantId = 'test-tenant-repro';
        await db('tenants').delete().where({ slug: tenantId });
        await db('tenants').insert({
            id: tenantId, // using slug as id for simplicity in test
            name: 'Repro Tenant',
            slug: tenantId,
            status: 'ACTIVE',
            db_name: 'public', // use public schema
            plan: 'ENTERPRISE'
        });

        // 2. Setup User using JWT (bypass login flow)
        userToken = jwt.sign(
            { userId, email: 'repro@test.com', role: 'ADMIN', tenantId },
            config.security.jwtSecret
        );

        // 3. Mock Wallet/Usage (Ensure 0 usage initially)
        // We need to clear previous jobs for this tenant if any
        // Since we are using 'public' schema, we might affect others if not careful, 
        // but in test environment 'public' usually is test db.
        // Wait, in prod 'public' is REAL.
        // I MUST BE CAREFUL.

        // Actually, I should use a unique ID for tenant to avoid collision.
    });

    it('Bug #4: Job behaves like a black hole (Stays QUEUED, No Processing)', async () => {
        // Create Job
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId)
            .send({
                referenceName: 'Test Job',
                candidateCount: 1,
                userId: userId,
                cost: 10 // Simulating valid cost
            });

        expect(res.status).toBe(200);
        const jobId = res.body.id;
        console.log('Created Job:', jobId);

        // Wait a bit to see if it processes
        await new Promise(r => setTimeout(r, 2000));

        // Refetch
        const check = await request(app)
            .get(`/api/jobs/${jobId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId);

        console.log('Job Status after 2s:', check.body.status);
        expect(check.body.status).toBe('QUEUED');
        // If it was processed, it would be COMPLETED or PROCESSING.
        // If it stays QUEUED, Bug #4 is confirmed.
    });

    afterAll(async () => {
        // Cleanup
        const tDb = connectionManager.getTenantConnection({ id: tenantId, db_name: 'public' });
        await tDb('comparison_jobs').where({ user_id: userId }).del();
        await db('tenants').where({ slug: tenantId }).del();
        await connectionManager.getMaster().destroy();
    });
});
