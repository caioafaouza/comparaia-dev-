const knex = require('knex')(require('../knexfile').development);
const bcrypt = require('bcryptjs');

async function createUser() {
    try {
        const dbName = 'tenant_multirede_1769804517270';
        const email = 'caio.souza@multiredebh.com';
        const password = 'Caio1991*';
        const hash = await bcrypt.hash(password, 10);

        // Check if user exists in tenant schema
        let user = await knex.withSchema(dbName).from('users').where({ email }).first();

        if (user) {
            console.log('User exists in tenant schema. Updating password...');
            await knex.withSchema(dbName).from('users').where({ email }).update({
                password: hash,
                role: 'ADMIN',
                status: 'ACTIVE',
                updated_at: knex.fn.now()
            });
        } else {
            console.log('Creating user in tenant schema...');
            await knex.withSchema(dbName).into('users').insert({
                id: knex.raw('gen_random_uuid()'),
                name: 'Caio Souza',
                email,
                password: hash,
                role: 'ADMIN',
                status: 'ACTIVE',
                created_at: knex.fn.now(),
                updated_at: knex.fn.now()
            });
        }
        console.log('User provisioned in tenant schema successfully.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

createUser();
