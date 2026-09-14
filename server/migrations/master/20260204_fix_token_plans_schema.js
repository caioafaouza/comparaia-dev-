
exports.up = function (knex) {
    return knex.schema.dropTableIfExists('token_plans')
        .then(() => {
            return knex.schema.createTable('token_plans', table => {
                table.string('id').primary(); // STARTER, PRO, ENTERPRISE
                table.string('name').notNullable();
                table.string('slug').unique(); // Optional, can be same as ID
                table.decimal('price', 10, 2).defaultTo(0);
                table.string('currency').defaultTo('BRL');
                table.boolean('active').defaultTo(true);
                table.json('limits'); // Stores JSON limits
                table.json('features'); // Stores JSON features
                table.timestamps(true, true);
            });
        });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('token_plans');
};
