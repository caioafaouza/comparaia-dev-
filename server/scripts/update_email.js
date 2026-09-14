const knex = require('knex')(require('../knexfile').development);

async function updateUser() {
    try {
        const dbName = 'tenant_multirede_1769804517270';
        const oldEmail = 'caio.souza@multiredebh.com';
        const newEmail = 'caio.souza@multiredebh.com.br';

        // Update in tenant schema
        const updated = await knex.withSchema(dbName).from('users')
            .where({ email: oldEmail })
            .update({ email: newEmail });

        console.log(`Updated ${updated} user(s) in tenant schema.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateUser();
