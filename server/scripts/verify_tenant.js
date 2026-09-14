const knex = require('knex')(require('../knexfile').development);

async function inspect() {
    try {
        const columns = await knex('tenants').columnInfo();
        console.log('Tenants Table Columns:', Object.keys(columns));

        const tenant = await knex('tenants').where('slug', 'multirede').first();
        console.log('Tenant Row:', tenant);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
