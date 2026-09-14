
const request = require('supertest');
// Mock AI Factory BEFORE requiring app
jest.mock('./services/aiFactory', () => ({
    getAIClient: jest.fn().mockResolvedValue({
        provider: 'MockAI',
        modelName: 'test-model',
        generateJSON: jest.fn().mockResolvedValue({
            score: 99,
            summary: 'Mock Analysis',
            recommendation: true
        })
    })
}));

const { createApp } = require('./app');
const connectionManager = require('./db/connectionManager');
const jwt = require('jsonwebtoken');
const config = require('./config/env');
const billingService = require('./services/billingService');

describe('Production Governance Flow', () => {
    let app;
    let db;
    let tenantId = 'verify-tenant';
    let userId = 'verify-user';
    let userToken;

    beforeAll(async () => {
        app = createApp();
        db = connectionManager.getMaster();

        // 1. Setup Tenant
        await db('tenants').delete().where({ slug: tenantId });
        await db('tenants').insert({
            id: tenantId,
            name: 'Verify Tenant',
            slug: tenantId,
            status: 'ACTIVE',
            db_name: 'public',
            plan: 'ENTERPRISE'
        });

        // 2. Setup Wallet (Add 50 tokens)
        await db('token_transactions').delete().where({ tenant_id: tenantId });
        await db('token_transactions').insert({
            id: 'setup-refill',
            tenant_id: tenantId,
            amount: 50,
            type: 'TOKEN_REFILL',
            status: 'CONFIRMED',
            created_at: new Date()
        });

        // 3. User Token
        userToken = jwt.sign(
            { userId, email: 'verify@test.com', role: 'ADMIN', tenantId },
            config.security.jwtSecret
        );
    });

    it('1. Should BLOCK creation if balance insufficient', async () => {
        // Attempt cost 100 (Balance 50)
        // Candidate Count 10 -> Cost 10*10 = 100? No, my formula was 10*count.
        // Wait, jobProcessor said `10 * count`.

        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId)
            .send({
                referenceName: 'Expensive Job',
                candidateCount: 6, // Cost 60
                userId: userId
            });

        expect(res.status).toBe(402);
        expect(res.body.error).toBe('INSUFFICIENT_TOKENS');
    });

    it('2. Should CREATE and PROCESS job if balance ok', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId)
            .send({
                referenceName: 'Valid Job',
                candidateCount: 1, // Cost 10
                userId: userId
            });

        expect(res.status).toBe(200);
        const jobId = res.body.id;
        console.log('Created Job:', jobId);

        // Verify Reserve Created
        const reserve = await db('token_transactions')
            .where({ reference_id: jobId, type: 'TOKEN_RESERVE' })
            .first();
        expect(reserve).toBeDefined();
        expect(Number(reserve.amount)).toBe(-10);

        // Wait for Async Processing
        console.log('Waiting for background processor...');
        await new Promise(r => setTimeout(r, 4000));

        // Verify Status Update
        const tDb = connectionManager.getTenantConnection({ id: tenantId, db_name: 'public' });
        const job = await tDb('comparison_jobs').where({ id: jobId }).first();

        console.log('Final Job Status:', job.status);
        console.log('Final Job Error:', job.error_message);

        // It should be COMPLETED or FAILED (due to missing AI Key) without hanging in QUEUED
        expect(['COMPLETED', 'FAILED']).toContain(job.status);

        if (job.status === 'COMPLETED') {
            const capture = await db('token_transactions')
                .where({ reference_id: jobId, status: 'CONFIRMED' })
                .first();
            expect(capture).toBeDefined();
        } else {
            // If failed (likely), should be refunded (CANCELLED)
            const refund = await db('token_transactions')
                .where({ reference_id: jobId, status: 'CANCELLED' })
                .first();
            expect(refund).toBeDefined();
        }
    }, 10000);

    afterAll(async () => {
        await connectionManager.getMaster().destroy();
        // await connectionManager.getTenantConnection(...).destroy(); // can't easily access
    });
});
