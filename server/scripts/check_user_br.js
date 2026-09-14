const knex = require('knex')(require('../knexfile').development);
const bcrypt = require('bcryptjs');

async function checkAndUpdateUser() {
    try {
        const dbName = 'tenant_multirede_1769804517270';
        const email = 'caio.souza@multiredebh.com.br';
        const password = 'Caio1991*';
        const hash = await bcrypt.hash(password, 10);

        const user = await knex.withSchema(dbName).from('users').where({ email }).first();
        console.log('User .br:', user ? 'FOUND' : 'NOT FOUND');

        if (user) {
            console.log('Updating password for existing .br user...');
            await knex.withSchema(dbName).from('users').where({ email }).update({
                password: hash,
                role: 'ADMIN',
                status: 'ACTIVE'
            });
            console.log('Password updated.');
        } else {
            console.log('User not found (weird given unique error). Checking non-.br user...');
            const oldUser = await knex.withSchema(dbName).from('users').where({ email: 'caio.souza@multiredebh.com' }).first();
            if (oldUser) {
                console.log('Found non-.br user. Unique error must be from something else?');
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAndUpdateUser();
