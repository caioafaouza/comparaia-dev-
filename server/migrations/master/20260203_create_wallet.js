// Wallet Table Migration - Master Schema
// Creates wallet table for tenant billing
// Run: npm run migrate:master

exports.up = async function (knex) {
    const hasWallet = await knex.schema.hasTable('wallet');

    if (hasWallet) {
        console.log('[Migration] wallet table already exists, skipping...');
        return;
    }

    await knex.schema.createTable('wallet', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('tenant_id').notNullable()
            .references('id').inTable('tenants')
            .onDelete('CASCADE');
        table.decimal('balance', 15, 2).notNullable().defaultTo(0);
        table.timestamps(true, true);

        // Indexes
        table.index(['tenant_id']);
        table.unique(['tenant_id']);  // One wallet per tenant
    });

    console.log('[Migration] Created wallet table');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('wallet');
};
