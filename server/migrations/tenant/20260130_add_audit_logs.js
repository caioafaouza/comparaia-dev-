exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('audit_logs');
  if (!exists) {
    await knex.schema.createTable('audit_logs', (table) => {
      table.string('id').primary();
      table.string('tenant_id');
      table.string('user_id');
      table.string('action').notNullable();
      table.string('resource').notNullable();
      table.text('details');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('audit_logs');
};
