
const knex = require('knex');
require('dotenv').config();

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: false
    }
});

(async () => {
    try {
        console.log('--- Tenants Table ---');
        const tenants = await db('tenants').select('*');
        console.table(tenants);

        console.log('\n--- Checking for conflict ---');
        // Check for any tenant that might conflict with 'Inctec Sistemas' 
        // Logic: name match OR slug match
        const conflict = await db('tenants')
            .where('name', 'ilike', '%Inctec%')
            .orWhere('slug', 'ilike', '%inctec%')
            .first();

        if (conflict) {
            console.log('Found zombie tenant:', conflict);
            // Delete it to allow retry
            await db('tenants').where({ id: conflict.id }).del();
            console.log('✅ Deleted zombie tenant successfully.');
        } else {
            console.log('No conflict found for "Inctec".');
        }

    } catch (e) {
        console.error(e);
    } finally {
        db.destroy();
    }
})();
