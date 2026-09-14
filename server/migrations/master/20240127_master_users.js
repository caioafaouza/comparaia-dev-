
exports.up = function (knex) {
    return knex.schema.createTable('users', table => {
        table.uuid('id').primary();
        table.string('name').notNullable();
        table.string('email').unique().notNullable();
        table.string('password').notNullable();
        table.string('role').defaultTo('PLATFORM_ADMIN');
        table.string('status').defaultTo('ACTIVE');
        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('users');
};
