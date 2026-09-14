
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        console.log('[Force Schema] Connecting...');
        const masterDb = connectionManager.getMaster();

        const tenant = await masterDb('tenants').where('name', 'ilike', '%Multirede%').first();
        if (!tenant) throw new Error('Tenant Multirede not found');

        console.log('[Force Schema] Target:', tenant.name);
        const tenantDb = connectionManager.getTenantConnection(tenant);

        // Raw SQL for idempotency
        const sql = `
            DO $$
            BEGIN
                BEGIN
                    ALTER TABLE comparison_jobs ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column started_at already exists in comparison_jobs.';
                END;
                BEGIN
                    ALTER TABLE comparison_jobs ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column completed_at already exists in comparison_jobs.';
                END;
                BEGIN
                    ALTER TABLE comparison_jobs ADD COLUMN error_message TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column error_message already exists in comparison_jobs.';
                END;
                BEGIN
                    ALTER TABLE comparison_jobs ADD COLUMN result JSONB;
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'column result already exists in comparison_jobs.';
                END;
            END
            $$;
        `;

        await tenantDb.raw(sql);
        console.log('[Force Schema] ✅ Columns added/verified successfully.');
        process.exit(0);

    } catch (e) {
        console.error('[Force Schema] Failed:', e);
        process.exit(1);
    }
})();
