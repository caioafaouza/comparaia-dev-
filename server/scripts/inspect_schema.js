const knex = require('knex')(require('../knexfile').development);

async function inspectSchema() {
    try {
        const columns = await knex('users').columnInfo();
        console.log('Users Table Columns:', Object.keys(columns));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectSchema();
