exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('ai_request_logs');
  if (exists) return;

  await knex.schema.createTable('ai_request_logs', (table) => {
    table.string('id').primary();
    table.string('tenant_id');
    table.string('user_id');
    table.string('provider').notNullable();
    table.string('model').notNullable();
    table.string('context').notNullable().defaultTo('unknown');
    table.integer('tokens_in').notNullable().defaultTo(0);
    table.integer('tokens_out').notNullable().defaultTo(0);
    table.integer('latency_ms').notNullable().defaultTo(0);
    table.boolean('success').notNullable().defaultTo(true);
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['tenant_id']);
    table.index(['created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ai_request_logs');
};
