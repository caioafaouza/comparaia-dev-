
const connectionManager = require('../server/db/connectionManager');
const { v4: uuidv4 } = require('uuid');

async function seedTenants() {
    const db = connectionManager.getMaster();

    const tenants = [
        { name: 'QA Tenant A', slug: 'qa-mp-a', id: '11111111-1111-1111-1111-111111111111' },
        { name: 'QA Tenant B', slug: 'qa-mp-b', id: '22222222-2222-2222-2222-222222222222' }
    ];

    console.log('--- SEEDING QA TENANTS ---');

    for (const t of tenants) {
        let tenant = await db('tenants').where({ slug: t.slug }).first();
        if (tenant) {
            // Update ID if possible? No, UUID is PK. 
            // If exists with different ID, delete and re-create.
            if (tenant.id !== t.id) {
                console.log(`Deleting old ${t.slug}...`);
                await db('tenants').where({ slug: t.slug }).del();
                tenant = null;
            }
        }

        if (!tenant) {
            console.log(`Creating ${t.slug} with ID ${t.id}...`);
            await db('tenants').insert({
                id: t.id,
                name: t.name,
                slug: t.slug,
                db_host: 'localhost',
                db_name: `tenant_${t.slug.replace(/-/g, '_')}`,
                db_user: 'postgres',
                db_password: 'pwd',
                plan: 'STARTER',
                status: 'ACTIVE',
                created_at: new Date()
            });
            tenant = await db('tenants').where({ slug: t.slug }).first();
        } else {
            console.log(`Tenant ${t.slug} exists.`);
        }

        // Reset Wallet (delete transactions)
        console.log(`Resetting wallet for ${t.slug}...`);
        await db('token_transactions').where({ tenant_id: tenant.id }).del();

        // Verify
        const txCount = await db('token_transactions').where({ tenant_id: tenant.id }).count('id as count');
        console.log(`${t.slug} Wallet Balance: 0 (Transactions: ${txCount[0].count})`);
    }

    process.exit(0);
}

seedTenants();
