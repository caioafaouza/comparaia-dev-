require('dotenv').config();
const knex = require('knex');

const config = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 0, max: 1 }
};

async function clean() {
    const db = knex(config);
    try {
        console.log('Cleaning qatest...');
        await db('tenants').where({ slug: 'qatest' }).del();
        await db.raw('DROP SCHEMA IF EXISTS "tenant_qatest" CASCADE');
        // Note: db_name usually random, finding it might be hard if row is gone, but we assume pattern or we dropped it in previous failed reset.
        // Actually previous reset dropped all tenant schemas.
        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}
clean();
