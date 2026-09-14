
exports.up = function (knex) {
    return knex.schema.createTable('system_config', table => {
        table.string('key').primary();
        table.json('value').notNullable(); // Stores value as JSON for flexibility
        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('system_config');
};
