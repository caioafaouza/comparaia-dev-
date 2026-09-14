
exports.up = async function (knex) {
    // 1. Ledger Updates
    const hasRef = await knex.schema.hasColumn('token_transactions', 'reference_id');
    if (!hasRef) {
        await knex.schema.alterTable('token_transactions', (table) => {
            table.string('reference_id').nullable();
            table.string('status').defaultTo('CONFIRMED');
            table.index(['reference_id']);
        });
    }

    // 2. Job Updates - MOVED TO TENANT MIGRATION
    // (See tenant/202602020000_tenant_job_columns.js)
};

exports.down = async function (knex) {
    // Optional down
};
