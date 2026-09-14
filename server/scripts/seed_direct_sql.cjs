require('dotenv').config();
const knex = require('knex');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Logging setup
const logFile = path.join(__dirname, '..', 'test-results', 'seed_direct_sql_output.txt');
const log = (msg) => {
    const line = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(msg);
};

// Ensure log dir
if (!fs.existsSync(path.dirname(logFile))) fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, '');

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
    pool: { min: 0, max: 1, acquireTimeoutMillis: 10000, idleTimeoutMillis: 5000 },
};

async function runSeed() {
    const db = knex(config);
    log('[SEED] Starting with Isolated Knex...');

    try {
        // 1. Introspect Schema for token_plans
        log('[SEED] Introspecting token_plans...');
        const planCols = await db('information_schema.columns')
            .where({ table_name: 'token_plans', table_schema: 'public' })
            .select('column_name');

        const validPlanCols = planCols.map(c => c.column_name);
        log(`[SEED] token_plans columns: ${validPlanCols.join(', ')}`);

        const hasTokenLimit = validPlanCols.includes('token_limit');
        const hasLimits = validPlanCols.includes('limits');

        // 2. Insert Token Plan 'free'
        const planSlug = 'free';
        const existingPlan = await db('token_plans').where({ slug: planSlug }).first();

        if (existingPlan) {
            log('[SEED] Plan "free" already exists. Skipping.');
        } else {
            const planData = {
                id: uuidv4(),
                slug: planSlug,
                name: 'Plano Gratuito',
                price: 0,
                active: true,
                features: JSON.stringify({ ai_models: ['gpt-3.5-turbo'], max_files: 5 }),
                created_at: new Date(),
                updated_at: new Date()
            };

            if (hasTokenLimit) {
                planData.token_limit = 100; // Integer
            } else if (hasLimits) {
                log('⚠️ WARNING: using "limits" json column fallback.');
                planData.limits = JSON.stringify({ monthlyTokens: 100 });
            } else {
                throw new Error('Schema mismatch: token_plans needs token_limit OR limits');
            }

            await db('token_plans').insert(planData);
            log('✅ Plan "free" inserted.');
        }

        // 3. Introspect Schema for users
        const userCols = await db('information_schema.columns')
            .where({ table_name: 'users', table_schema: 'public' })
            .select('column_name');
        const validUserCols = userCols.map(c => c.column_name);

        const hasTenantId = validUserCols.includes('tenant_id');

        // 4. Insert Platform Admin
        const adminEmail = 'contato@inctec.com.br';
        const existingAdmin = await db('users').where({ email: adminEmail }).first();

        if (existingAdmin) {
            log('[SEED] Admin already exists. Skipping.');
        } else {
            // Hash for '123456'
            const finalHash = '$2a$10$EpW.X.X.X.X.X.X.X.X.X.e';
            let password = finalHash;
            try {
                const bcrypt = require('bcryptjs');
                password = await bcrypt.hash('123456', 10);
            } catch (e) {
                log('Notice: using placeholder hash (bcryptjs missing)');
            }

            const userData = {
                id: uuidv4(),
                name: 'Platform Admin',
                email: adminEmail,
                password: password,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                created_at: new Date(),
                updated_at: new Date()
            };

            if (hasTenantId) {
                userData.tenant_id = null;
            }

            await db('users').insert(userData);
            log('✅ Admin inserted.');
        }

        // 5. Final Checks
        const finalPlan = await db('token_plans').where({ slug: 'free' }).first();
        if (!finalPlan) throw new Error('Post-seed check failed: Plan "free" missing');

        const finalAdmin = await db('users').where({ email: adminEmail }).first();
        if (!finalAdmin) throw new Error('Post-seed check failed: Admin user missing');

        log('✅ Seed Completed Successfully');
        process.exit(0);

    } catch (err) {
        log(`❌ SEED FAILED: ${err.message}`);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

runSeed();
