
exports.up = async function (knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', table => {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.string('role').defaultTo('MEMBER');
      table.string('status').defaultTo('ACTIVE');
      table.timestamps(true, true);
    });
  }

  const hasProducts = await knex.schema.hasTable('products');
  if (!hasProducts) {
    await knex.schema.createTable('products', table => {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('category');
      table.decimal('initial_cost', 15, 2);
      table.integer('stock_quantity').defaultTo(0);
      table.integer('min_stock').defaultTo(5);
      table.json('technical_specs');
      table.timestamps(true, true);
    });
  }

  const hasComparisonJobs = await knex.schema.hasTable('comparison_jobs');
  if (!hasComparisonJobs) {
    await knex.schema.createTable('comparison_jobs', table => {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users');
      table.string('reference_name').notNullable();
      table.string('status').defaultTo('QUEUED');
      table.integer('candidate_count').defaultTo(0);
      table.decimal('cost', 10, 2).defaultTo(0);
      table.json('result');
      table.text('error_message');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at');
    });
  }

  const hasStockMovements = await knex.schema.hasTable('stock_movements');
  if (!hasStockMovements) {
    await knex.schema.createTable('stock_movements', table => {
      table.increments('id').primary();
      table.uuid('product_id').references('id').inTable('products');
      table.string('type').notNullable(); // SQLite doesn't strictly support ENUM
      table.integer('quantity').notNullable();
      table.decimal('unit_cost', 15, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('stock_movements')
    .dropTableIfExists('comparison_jobs')
    .dropTableIfExists('products')
    .dropTableIfExists('users');
};
