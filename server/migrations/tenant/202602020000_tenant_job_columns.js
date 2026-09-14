exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable('comparison_jobs');
    if (hasTable) {
        // Use raw SQL for robust idempotency
        await knex.raw(`ALTER TABLE "comparison_jobs" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'COMPARE_DOCS'`);
        await knex.raw(`ALTER TABLE "comparison_jobs" ADD COLUMN IF NOT EXISTS "started_at" timestamptz NULL`);
        await knex.raw(`ALTER TABLE "comparison_jobs" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz NULL`);
        await knex.raw(`ALTER TABLE "comparison_jobs" ADD COLUMN IF NOT EXISTS "error_message" text NULL`);
        await knex.raw(`ALTER TABLE "comparison_jobs" ADD COLUMN IF NOT EXISTS "result" json NULL`);
    }

    // Idempotent constraint creation
    await knex.raw('ALTER TABLE "comparison_jobs" DROP CONSTRAINT IF EXISTS "comparison_jobs_type_check"');
    await knex.raw(`
        ALTER TABLE "comparison_jobs"
        ADD CONSTRAINT "comparison_jobs_type_check" 
        CHECK ("type" IN ('COMPARE_DOCS', 'COMPARE_DATA', 'EXTRACT_DATA'))
    `);
};

exports.down = async function (knex) {
    const hasTable = await knex.schema.hasTable('comparison_jobs');
    if (hasTable) {
        await knex.raw('ALTER TABLE "comparison_jobs" DROP CONSTRAINT IF EXISTS "comparison_jobs_type_check"');

        // We can drop columns if we want, or leave them. 
        // For strict down:
        await knex.schema.alterTable('comparison_jobs', (table) => {
            table.dropColumn('started_at');
            table.dropColumn('completed_at');
            table.dropColumn('error_message');
            table.dropColumn('result');
            // table.dropColumn('type'); // safe to keep
        });
    }
};
