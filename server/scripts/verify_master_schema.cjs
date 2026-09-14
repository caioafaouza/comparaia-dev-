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

async function verify() {
    const db = knex(config);
    try {
        console.log('=== VERIFY MASTER SCHEMA ===');

        // 1. Get all tables
        const tables = await db('information_schema.tables')
            .where({ table_schema: 'public', table_type: 'BASE TABLE' })
            .select('table_name')
            .orderBy('table_name');

        const tableNames = tables.map(t => t.table_name);

        // 2. Deep inspect critical tables
        const criticalTables = ['token_plans', 'users', 'tenants', 'token_transactions', 'wallet'];
        const columnsDetails = {};

        for (const t of criticalTables) {
            if (tableNames.includes(t)) {
                const cols = await db('information_schema.columns')
                    .where({ table_schema: 'public', table_name: t })
                    .select('column_name', 'data_type');
                columnsDetails[t] = cols;
            } else {
                console.error(`❌ CRITICAL TABLE MISSING: ${t}`);
                throw new Error(`Table ${t} missing from public schema`);
            }
        }

        const snapshot = {
            timestamp: new Date().toISOString(),
            schema: 'public',
            tables: tableNames,
            details: columnsDetails,
            count: tableNames.length
        };

        // 3. Save Snapshot
        const outDir = path.join(__dirname, '..', 'test-results');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        fs.writeFileSync(
            path.join(outDir, 'master_schema_snapshot.json'),
            JSON.stringify(snapshot, null, 2)
        );
        console.log('✅ Master Schema Snapshot Saved');

        // 4. DRIFT CHECK: token_plans
        const planCols = columnsDetails['token_plans'] || [];
        const hasTokenLimit = planCols.some(c => c.column_name === 'token_limit');
        const hasLimits = planCols.some(c => c.column_name === 'limits');

        if (hasLimits) {
            console.error('❌ DRIFT: token_plans table has deprecated "limits" column (JSON). Expected "token_limit" (integer).');
            throw new Error('Schema Drift Detected: limits column exists');
        }

        if (!hasTokenLimit) {
            console.error('❌ DRIFT: token_plans table MISSING "token_limit" column.');
            throw new Error('Schema Drift Detected: token_limit missing');
        }

        console.log('✅ Schema Drift Check: token_plans OK');

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

verify();
