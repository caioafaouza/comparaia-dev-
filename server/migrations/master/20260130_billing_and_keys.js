exports.up = async function (knex) {
  // 1. Ensure token_transactions exists (missing in some envs)
  const hasTokenTransactions = await knex.schema.hasTable('token_transactions');
  if (!hasTokenTransactions) {
    await knex.schema.createTable('token_transactions', (table) => {
      table.uuid('id').primary();
      table.uuid('tenant_id').references('id').inTable('tenants');
      table.decimal('amount', 14, 2).notNullable();
      table.string('type').notNullable().defaultTo('USAGE');
      table.string('description');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['tenant_id']);
    });
  } else {
    // If table exists, ensure 'type' column exists
    const hasType = await knex.schema.hasColumn('token_transactions', 'type');
    if (!hasType) {
      await knex.schema.alterTable('token_transactions', (table) => {
        table.string('type').notNullable().defaultTo('TOKEN_REFILL');
      });
    }
  }

  // 2. Tenant API Keys
  const hasTenantApiKeys = await knex.schema.hasTable('tenant_api_keys');
  if (!hasTenantApiKeys) {
    await knex.schema.createTable('tenant_api_keys', (table) => {
      table.string('id').primary();
      table.string('tenant_id').notNullable();
      table.string('name').notNullable();
      table.string('key_prefix').notNullable();
      table.string('key_hash').notNullable();
      table.string('status').notNullable().defaultTo('ACTIVE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('revoked_at');
      table.unique(['key_hash']);
      table.unique(['key_prefix']);
      table.index(['tenant_id']);
    });
  }

  // 3. Billing Failures
  const hasBillingFailures = await knex.schema.hasTable('billing_failures');
  if (!hasBillingFailures) {
    await knex.schema.createTable('billing_failures', (table) => {
      table.string('id').primary();
      table.string('tenant_id').notNullable();
      table.decimal('amount', 14, 2).notNullable().defaultTo(0);
      table.text('reason');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['tenant_id']);
    });
  }
};

exports.down = async function (knex) {
  const hasType = await knex.schema.hasColumn('token_transactions', 'type');
  if (hasType) {
    await knex.schema.alterTable('token_transactions', (table) => {
      table.dropColumn('type');
    });
  }
  await knex.schema.dropTableIfExists('billing_failures');
  await knex.schema.dropTableIfExists('tenant_api_keys');
  // We do NOT drop token_transactions because we might have created it just for fix, 
  // but logically strictly "down" should reverse "up". 
  // However if it was supposed to exist before, dropping it might be wrong.
  // Leaving it as is to avoid data loss.
};
