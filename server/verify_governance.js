
const request = require('supertest');
const { createApp } = require('./app');
const connectionManager = require('./db/connectionManager');
const jwt = require('jsonwebtoken');
const config = require('./config/env');
const crypto = require('crypto');

(async () => {
    try {
        console.log('--- STARTING GOVERNANCE VERIFICATION ---');
        const app = createApp();
        const db = connectionManager.getMaster();

        // 1. Setup Tenant
        const tenantId = crypto.randomUUID();
        const userId = crypto.randomUUID();

        console.log('1. Setting up Tenant:', tenantId);
        await db('tenants').insert({
            id: tenantId,
            name: 'Governance Verify',
            slug: 'verify-' + Date.now().toString(36),
            status: 'ACTIVE',
            db_name: 'verify_' + tenantId.substring(0, 8),
            db_host: '127.0.0.1',
            db_user: 'comparaia',
            db_password: 'ddaCxxXzJr4iCBET',
            plan: 'ENTERPRISE'
        });

        // 2. Add Tokens
        await db('token_transactions').insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            amount: 50,
            type: 'TOKEN_REFILL',
            status: 'CONFIRMED',
            created_at: new Date()
        });

        const userToken = jwt.sign(
            { userId, email: 'gov@test.com', role: 'ADMIN', tenantId },
            config.security.jwtSecret
        );

        // 3. Test Insufficient Funds
        console.log('2. Testing Credit Gate...');
        const resBlocked = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId)
            .send({
                referenceName: 'Expensive Job',
                candidateCount: 10, // Cost 100 > 50
                userId: userId
            });

        if (resBlocked.status === 402) {
            console.log('[PASS] Credit Gate blocked request.');
        } else {
            console.error('[FAIL] Credit Gate allowed request! Status:', resBlocked.status);
        }

        // 4. Test Valid Job & Execution Flow
        console.log('3. Testing Execution Flow...');
        const resOk = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${userToken}`)
            .set('X-Tenant-ID', tenantId)
            .send({
                referenceName: 'Valid Job',
                candidateCount: 1, // Cost 10
                userId: userId
            });

        if (resOk.status !== 200) {
            console.error('[FAIL] Job creation failed:', resOk.body);
        } else {
            const jobId = resOk.body.id;
            console.log('[PASS] Job Created:', jobId);

            // Verify Reserve
            const reserve = await db('token_transactions')
                .where({ reference_id: jobId, type: 'TOKEN_RESERVE' })
                .first();
            if (reserve && Number(reserve.amount) === -10) {
                console.log('[PASS] Ledger Reserved -10 tokens.');
            } else {
                console.error('[FAIL] Ledger Reserve missing or incorrect:', reserve);
            }

            console.log('4. Waiting for Processor (5s)...');
            await new Promise(r => setTimeout(r, 5000));

            // Verify Status
            const tDb = connectionManager.getTenantConnection({ id: tenantId, db_name: 'public' });
            const job = await tDb('comparison_jobs').where({ id: jobId }).first();
            console.log('Job Status:', job.status);
            console.log('Job Error:', job.error_message);

            if (job.status === 'QUEUED') {
                console.error('[FAIL] Job is stuck in QUEUED - Processor not running!');
            } else if (job.status === 'FAILED') {
                console.log('[PASS] Job attempted execution (FAILED is expected without AI Key).');
                // Check Refund
                const refund = await db('token_transactions')
                    .where({ reference_id: jobId, status: 'CANCELLED' })
                    .first();
                if (refund) {
                    console.log('[PASS] Credits Refunded (Status CANCELLED).');
                } else {
                    console.error('[FAIL] Credits NOT Refunded!');
                }
            } else if (job.status === 'COMPLETED') {
                console.log('[PASS] Job COMPLETED successfully!');
                const capture = await db('token_transactions')
                    .where({ reference_id: jobId, status: 'CONFIRMED' })
                    .first();
                if (capture) {
                    console.log('[PASS] Credits Captured (Status CONFIRMED).');
                } else {
                    console.error('[FAIL] Credits NOT Captured!');
                }
            }
        }

        // Cleanup
        await db('token_transactions').where({ tenant_id: tenantId }).del();
        await db('tenants').where({ slug: tenantId }).del();
        await connectionManager.getMaster().destroy();

    } catch (err) {
        console.error('Fatal Error:', err);
        process.exit(1);
    }
})();
