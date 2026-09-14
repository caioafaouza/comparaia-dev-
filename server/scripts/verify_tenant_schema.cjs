require('dotenv').config();
const knex = require('knex');
const fs = require('fs');
const path = require('path');

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

async function verifyTenant() {
    const db = knex(config);
    console.log('=== VERIFY TENANT SCHEMA ===');
    try {
        const tenant = await db('tenants').where({ slug: 'qatest' }).first();
        if (!tenant) {
            console.error('❌ Tenant "qatest" not found');
            process.exit(1);
        }

        const schemaName = tenant.db_name;
        console.log(`Checking schema: ${schemaName}`);

        const tables = await db('information_schema.tables')
            .where({ table_schema: schemaName, table_type: 'BASE TABLE' })
            .select('table_name')
            .orderBy('table_name');

        const tableNames = tables.map(t => t.table_name);

        // Required Tables Check
        const requiredTables = ['users', 'products', 'comparison_jobs'];
        const missing = requiredTables.filter(t => !tableNames.includes(t));

        if (missing.length > 0) {
            throw new Error(`Tenant schema missing required tables: ${missing.join(', ')}`);
        }

        const snapshot = {
            timestamp: new Date().toISOString(),
            tenant: 'qatest',
            schema: schemaName,
            tables: tableNames,
            count: tableNames.length
        };

        const outDir = path.join(__dirname, '..', 'test-results');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        fs.writeFileSync(
            path.join(outDir, 'tenant_schema_snapshot.json'),
            JSON.stringify(snapshot, null, 2)
        );

        console.log('✅ Tenant Schema Snapshot Saved');
        console.log('Tables:', tableNames.join(', '));

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

verifyTenant();
