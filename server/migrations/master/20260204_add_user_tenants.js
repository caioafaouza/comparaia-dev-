exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('user_tenants');
    if (!exists) {
        return knex.schema.createTable('user_tenants', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid());
            table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
            table.string('role').defaultTo('MEMBER'); // OWNER, ADMIN, MEMBER
            table.unique(['user_id', 'tenant_id']);
            table.timestamps(true, true);
        });
    }
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('user_tenants');
};
