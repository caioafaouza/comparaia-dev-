
const connectionManager = require('./db/connectionManager');
const jobProcessor = require('./services/jobProcessor');
const billingService = require('./services/billingService');
const crypto = require('crypto');

(async () => {
    try {
        console.log('[Verify] Connecting to DB...');
        const masterDb = connectionManager.getMaster();

        // 1. Get a Tenant (First one)
        const tenant = await masterDb('tenants').first();
        if (!tenant) throw new Error('No tenant found');
        console.log('[Verify] Tenant:', tenant.name, tenant.id);

        const tenantDb = connectionManager.getTenantConnection(tenant);

        // 2. Create Dummy Job
        const jobId = crypto.randomUUID();
        console.log('[Verify] Creating Dummy Job:', jobId);

        await tenantDb('comparison_jobs').insert({
            id: jobId,
            user_id: 'VERIFY_SCRIPT',
            reference_name: 'Teste de Verificacao',
            candidate_count: 2,
            cost: 10.00,
            status: 'QUEUED',
            created_at: new Date()
        });

        // 3. Reserve Credits
        console.log('[Verify] Reserving Credits...');
        await billingService.reserveCredits(tenant.id, 10.00, jobId);

        // 4. Run Processor
        console.log('[Verify] Running Job Processor...');
        // Mock request context if needed? jobProcessor needs tenant object.
        // It fetches job from DB.

        // Important: check if jobProcessor expects real files? 
        // It calls `aiFactory`. 
        // If files are null, it might fail?
        // `analyzeRaw` validates payload.
        // `jobProcessor` constructs payload from `job.files`.

        // Let's ensure the job has minimal valid data. 
        // If `files` column is null, `jobProcessor` might complain.
        // Let's check jobProcessor logic quickly? 
        // I will run it and see. If it fails due to "Missing Files", that's a finding.

        await jobProcessor.processJob(jobId, tenant);

        console.log('[Verify] Job Processor Finished');

        // 5. Check Result
        const updatedJob = await tenantDb('comparison_jobs').where({ id: jobId }).first();
        console.log('[Verify] Job Status:', updatedJob.status);
        console.log('[Verify] Job Error:', updatedJob.error_message);

        // 6. Check Transaction
        const tx = await masterDb('token_transactions').where({ reference_id: jobId }).orderBy('created_at', 'desc').first();
        console.log('[Verify] Transaction Status:', tx.status);

        process.exit(0);

    } catch (e) {
        console.error('[Verify] Failed:', e);
        process.exit(1);
    }
})();
