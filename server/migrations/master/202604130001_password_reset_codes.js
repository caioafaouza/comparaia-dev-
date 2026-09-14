exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable('password_reset_codes');
  if (hasTable) return;

  await knex.schema.createTable('password_reset_codes', (table) => {
    table.uuid('id').primary();
    table.string('email', 255).notNullable();
    table.string('code_hash', 128).notNullable();
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS password_reset_codes_email_idx ON password_reset_codes (lower(email))');
  await knex.raw('CREATE INDEX IF NOT EXISTS password_reset_codes_expires_idx ON password_reset_codes (expires_at)');
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS password_reset_codes_email_idx');
  await knex.raw('DROP INDEX IF EXISTS password_reset_codes_expires_idx');
  await knex.schema.dropTableIfExists('password_reset_codes');
};
