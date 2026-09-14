exports.up = async function (knex) {
  // Use async/await for sequential execution
  await knex.schema.createTable('api_gateway_config', (table) => {
    table.increments('id').primary();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.string('api_version').notNullable().defaultTo('v1');
    table.integer('global_rate_limit').notNullable().defaultTo(1200);
    table.integer('timeout_ms').notNullable().defaultTo(15000);
    table.text('cors_origins');
    table.boolean('enable_logging').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('smtp_config', (table) => {
    table.increments('id').primary();
    table.string('host');
    table.integer('port');
    table.string('user');
    table.text('pass');
    table.boolean('secure').notNullable().defaultTo(false);
    table.string('from_email');
    table.timestamps(true, true);
  });

  const hasTokenPlans = await knex.schema.hasTable('token_plans');
  if (!hasTokenPlans) {
    await knex.schema.createTable('token_plans', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.decimal('price', 12, 2).notNullable().defaultTo(0);
      table.string('currency').notNullable().defaultTo('BRL');
      table.boolean('active').notNullable().defaultTo(true);
      table.text('limits');
      table.text('features');
      table.timestamps(true, true);
    });
  }

  await knex.schema.createTable('token_packages', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.integer('tokens').notNullable().defaultTo(0);
    table.decimal('price', 12, 2).notNullable().defaultTo(0);
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // Token Transactions: Check if exists first
  const hasTokenTransactions = await knex.schema.hasTable('token_transactions');
  if (!hasTokenTransactions) {
    await knex.schema.createTable('token_transactions', (table) => {
      table.uuid('id').primary();
      table.uuid('tenant_id').references('id').inTable('tenants');
      table.decimal('amount', 14, 2).notNullable();
      table.string('type').notNullable().defaultTo('USAGE');
      table.string('description');
      table.json('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['tenant_id']);
    });
  }

  await knex.schema.createTable('crm_leads', (table) => {
    table.string('id').primary();
    table.string('company_name').notNullable();
    table.string('contact_name').notNullable();
    table.string('email').notNullable();
    table.string('status').notNullable().defaultTo('NEW');
    table.decimal('value', 14, 2).notNullable().defaultTo(0);
    table.decimal('probability', 5, 2).notNullable().defaultTo(0);
    table.text('notes');
    table.text('interactions');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('system_api_keys', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('key_prefix').notNullable();
    table.string('key_hash').notNullable();
    table.string('role').notNullable().defaultTo('READ_ONLY');
    table.string('status').notNullable().defaultTo('ACTIVE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at');
    table.unique(['key_hash']);
    table.unique(['key_prefix']);
  });

  await knex.schema.createTable('webhooks', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('url').notNullable();
    table.text('secret');
    table.text('events');
    table.boolean('active').notNullable().defaultTo(true);
    table.string('last_status');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('webhook_logs', (table) => {
    table.string('id').primary();
    table.string('webhook_id').notNullable();
    table.string('event').notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.integer('status_code').notNullable().defaultTo(0);
    table.integer('latency').notNullable().defaultTo(0);
    table.text('payload_preview');
  });

  await knex.schema.createTable('payment_gateways', (table) => {
    table.string('provider').primary();
    table.string('name').notNullable();
    table.boolean('active').notNullable().defaultTo(false);
    table.boolean('is_default').notNullable().defaultTo(false);
    table.text('credentials');
    table.text('custom_instructions');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('payment_gateways')
    .dropTableIfExists('webhook_logs')
    .dropTableIfExists('webhooks')
    .dropTableIfExists('system_api_keys')
    .dropTableIfExists('crm_leads')
    .dropTableIfExists('token_transactions')
    .dropTableIfExists('token_packages')
    .dropTableIfExists('token_plans')
    .dropTableIfExists('smtp_config')
    .dropTableIfExists('api_gateway_config');
};
