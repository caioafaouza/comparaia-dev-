
exports.up = function (knex) {
    return knex.schema
        // Products table for Master (Global Catalog or Admin Testing)
        .createTable('products', table => {
            table.uuid('id').primary();
            table.string('name').notNullable();
            table.string('category');
            table.decimal('initial_cost', 15, 2);
            table.integer('stock_quantity').defaultTo(0);
            table.integer('min_stock').defaultTo(5);
            table.json('technical_specs');
            table.timestamps(true, true);
        })
        // Comparison Jobs for Master Admin
        .createTable('comparison_jobs', table => {
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
        })
        // Stock Movements for Master
        .createTable('stock_movements', table => {
            table.increments('id').primary();
            table.uuid('product_id').references('id').inTable('products');
            table.string('type').notNullable();
            table.integer('quantity').notNullable();
            table.decimal('unit_cost', 15, 2);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('stock_movements')
        .dropTableIfExists('comparison_jobs')
        .dropTableIfExists('products');
};
