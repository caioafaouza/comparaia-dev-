const connectionManager = require('../db/connectionManager');

async function checkData() {
    try {
        const db = connectionManager.getMaster();

        console.log('--- Checking Tenants ---');
        const tenants = await db('tenants').select('*');
        console.log(`Found ${tenants.length} tenants.`);

        for (const t of tenants) {
            console.log(`\nChecking Schema for: ${t.name} (${t.db_name})`);
            try {
                // Check if schema exists (Postgres specific)
                const schemaExists = await db.raw(
                    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?",
                    [t.db_name]
                );

                if (schemaExists.rows.length > 0) {
                    console.log(`✅ Schema '${t.db_name}' exists.`);

                    // Check user count in schema
                    const users = await db.withSchema(t.db_name).select('count(*)').from('users');
                    console.log(`   Users in schema: ${users[0].count}`);
                } else {
                    console.log(`❌ Schema '${t.db_name}' DOES NOT EXIST.`);
                }
            } catch (err) {
                console.log(`   Error checking schema: ${err.message}`);
            }
        }

    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        process.exit();
    }
}

checkData();
