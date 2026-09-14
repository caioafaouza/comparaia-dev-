const knex = require('knex');
const config = require('../config/env');

const db = knex({
    client: 'pg',
    connection: config.db,
    searchPath: ['public']
});

async function run() {
    const dbName = 'tenant_tenantteste01_1770220518274'; // Copied from log
    console.log(`Checking schema: ${dbName}`);

    try {
        // 1. Check Tables in Schema
        const tables = await db('information_schema.tables')
            .select('table_name')
            .where({ table_schema: dbName });

        console.log('Tables found:', tables.map(t => t.table_name).join(', '));

        // 2. Count Users
        if (tables.find(t => t.table_name === 'users')) {
            const count = await db.withSchema(dbName).from('users').count('* as c').first();
            console.log(`Users count: ${count.c}`);
            const users = await db.withSchema(dbName).from('users').select('*');
            console.table(users);
        } else {
            console.log('❌ Users table NOT found in schema.');
        }

        // 3. Check Public Users (Leak Check)
        const publicUsers = await db.withSchema('public').from('users').select('id', 'name', 'email', 'role');
        console.log('Public Users:', publicUsers.length);
        console.table(publicUsers);

    } catch (err) {
        console.error(err);
    } finally {
        await db.destroy();
    }
}

run();
