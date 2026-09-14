
exports.up = function (knex) {
  return knex.schema
    .createTable('tenants', table => {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('slug').unique().notNullable(); // Subdomínio
      table.string('db_host').notNullable();
      table.string('db_name').unique().notNullable();
      table.string('db_user').notNullable();
      table.string('db_password').notNullable();
      table.enum('status', ['ACTIVE', 'SUSPENDED', 'PROVISIONING']).defaultTo('ACTIVE');
      table.string('plan').defaultTo('STARTER');
      table.timestamps(true, true);
    })
    .createTable('token_plans', table => {
      table.uuid('id').primary(); // UUID primary key
      table.string('name').notNullable();
      table.string('slug').unique().notNullable();
      table.decimal('price', 10, 2).notNullable().defaultTo(0);
      table.string('currency').defaultTo('BRL');
      table.boolean('active').defaultTo(true);
      table.integer('token_limit'); // Replaces 'limits' JSON
      table.json('features');
      table.timestamps(true, true);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTable('token_plans')
    .dropTable('tenants');
};
