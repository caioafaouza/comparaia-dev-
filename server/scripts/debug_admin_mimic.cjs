const connectionManager = require('../db/connectionManager');

async function mimic() {
    console.log('🕵️ Mimicking Admin Controller...');

    try {
        const db = connectionManager.getMaster();
        const tenants = await db('tenants').select('id', 'name', 'slug', 'db_name', 'plan');
        console.log(`Found ${tenants.length} tenants.`);

        let allUsers = [];

        for (const tenant of tenants) {
            console.log(`Processing ${tenant.slug} (Schema: ${tenant.db_name})...`);
            try {
                // Mimic EXACTLY the controller logic
                const users = await db.withSchema(tenant.db_name).select('id', 'name', 'email', 'role', 'status')
                    .from('users');

                console.log(`   ✅ Success! Found ${users.length} users.`);
                users.forEach(u => allUsers.push(u));
            } catch (e) {
                console.error(`   ❌ FAILED for ${tenant.slug}:`);
                console.error(`      Message: ${e.message}`);
                // console.error(`      Stack: ${e.stack}`);
            }
        }

        console.log('Total Users Collected:', allUsers.length);

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await connectionManager.destroy();
    }
}

mimic();
