exports.up = async function (knex) {
  const hasOrders = await knex.schema.hasTable('billing_orders');
  if (!hasOrders) {
    await knex.schema.createTable('billing_orders', (table) => {
      table.uuid('id').primary();
      table.uuid('tenant_id').notNullable().index();
      table.uuid('user_id').notNullable().index();
      table.string('order_type').notNullable();
      table.string('item_id').notNullable();
      table.decimal('amount', 14, 2).notNullable().defaultTo(0);
      table.string('currency').defaultTo('BRL');
      table.string('status').notNullable().defaultTo('CREATED');
      table.string('provider').notNullable().defaultTo('MERCADO_PAGO');
      table.string('idempotency_key').notNullable();
      table.string('external_reference');
      table.string('preference_id');
      table.string('payment_id');
      table.text('init_point');
      table.text('sandbox_init_point');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['idempotency_key']);
      table.index(['status']);
      table.index(['external_reference']);
    });
  }

  const hasEvents = await knex.schema.hasTable('billing_events');
  if (!hasEvents) {
    await knex.schema.createTable('billing_events', (table) => {
      table.uuid('id').primary();
      table.string('provider').notNullable().index();
      table.string('event_id').notNullable();
      table.string('event_type');
      table.string('resource_id');
      table.jsonb('payload');
      table.boolean('signature_valid').defaultTo(false);
      table.string('status').notNullable().defaultTo('RECEIVED');
      table.timestamp('received_at').defaultTo(knex.fn.now());
      table.timestamp('processed_at');
      table.unique(['provider', 'event_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('billing_events');
  await knex.schema.dropTableIfExists('billing_orders');
};
