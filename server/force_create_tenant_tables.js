
const connectionManager = require('./db/connectionManager');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function run() {
    try {
        const db = connectionManager.getMaster();
        const schema = 'tenant_multirede';

        console.log(`Setting up schema ${schema}...`);

        // 1. Users
        await db.raw(`CREATE TABLE IF NOT EXISTS "${schema}".users (
            id uuid PRIMARY KEY,
            name varchar(255) NOT NULL,
            email varchar(255) UNIQUE NOT NULL,
            password varchar(255) NOT NULL,
            role varchar(255) DEFAULT 'MEMBER',
            status varchar(255) DEFAULT 'ACTIVE',
            created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Products
        await db.raw(`CREATE TABLE IF NOT EXISTS "${schema}".products (
            id uuid PRIMARY KEY,
            name varchar(255) NOT NULL,
            category varchar(255),
            initial_cost decimal(15,2),
            stock_quantity integer DEFAULT 0,
            min_stock integer DEFAULT 5,
            technical_specs json,
            created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
        )`);

        // 3. Jobs
        await db.raw(`CREATE TABLE IF NOT EXISTS "${schema}".comparison_jobs (
            id uuid PRIMARY KEY,
            user_id uuid REFERENCES "${schema}".users(id),
            reference_name varchar(255) NOT NULL,
            status varchar(255) DEFAULT 'QUEUED',
            candidate_count integer DEFAULT 0,
            cost decimal(10,2) DEFAULT 0,
            result json,
            error_message text,
            started_at timestamptz,
            completed_at timestamptz,
            created_at timestamptz DEFAULT CURRENT_TIMESTAMP
        )`);

        // SEED USER
        const existing = await db('users').withSchema(schema).where({ email: 'admin@multirede.com.br' }).first();
        if (!existing) {
            const hash = await bcrypt.hash('123456', 10);
            await db('users').withSchema(schema).insert({
                id: crypto.randomUUID(),
                name: 'Tenant Admin',
                email: 'admin@multirede.com.br',
                password: hash,
                role: 'ADMIN',
                status: 'ACTIVE'
            });
            console.log('Tenant Admin seeded.');
        }

        console.log('DONE');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
