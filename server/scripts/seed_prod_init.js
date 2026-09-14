const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');

/**
 * Seed Inicial de Produção
 * Idempotente: Verifica se existe antes de criar.
 */
async function seed(db) {
    console.log('🌱 executando seed_prod_init...');

    // 1. Token Plans
    const freePlanSlug = 'free';
    const existingFree = await db('token_plans').where({ id: freePlanSlug }).first();
    if (!existingFree) {
        console.log('   + Criando plano FREE');
        await db('token_plans').insert({
            id: freePlanSlug,
            name: 'Free Tier',
            price: 0.00,
            currency: 'BRL',
            active: true,
            limits: JSON.stringify({ daily_requests: 100 }), // Exemplo
            features: JSON.stringify(['basic_support']),
            created_at: new Date(),
            updated_at: new Date()
        });
    } else {
        console.log('   . Plano FREE já existe');
    }

    // 2. Platform Admin
    const adminEmail = 'contato@inctec.com.br';
    const existingAdmin = await db('users').where({ email: adminEmail }).first();

    if (!existingAdmin) {
        console.log(`   + Criando Admin: ${adminEmail}`);
        const hash = await bcrypt.hash('Caio*1991', 10);
        // UUID fixo ou gerado? Gerado é melhor, mas fixo ajuda em testes. Vamos gerar.
        await db('users').insert({
            id: uuidv4(),
            name: 'Super Admin',
            email: adminEmail,
            password: hash,
            role: 'PLATFORM_ADMIN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
        });
    } else {
        console.log(`   . Admin ${adminEmail} já existe. Verificando Role...`);
        if (existingAdmin.role !== 'PLATFORM_ADMIN') {
            console.log('   ! Corrigindo Role Admin para PLATFORM_ADMIN');
            await db('users').where({ id: existingAdmin.id }).update({ role: 'PLATFORM_ADMIN' });
        }
    }

    // 3. Garantir Tenant base (Opcional, mas util para login inicial)
    // O reset_prod.js v4 criava o inctec. Vamos manter aqui também para garantir.
    const tenantSlug = 'inctec';
    const existingTenant = await db('tenants').where({ slug: tenantSlug }).first();

    if (!existingTenant) {
        console.log(`   + Criando Tenant Base: ${tenantSlug}`);
        const tenantId = uuidv4();
        await db('tenants').insert({
            id: tenantId,
            name: 'Inctec',
            slug: tenantSlug,
            db_host: config.db.host,
            db_name: config.db.database,
            db_user: config.db.user,
            db_password: config.db.password,
            status: 'ACTIVE',
            plan: 'STARTER',
            created_at: new Date(),
            updated_at: new Date()
        });

        // Vincular Admin ao Tenant
        const adminUser = await db('users').where({ email: adminEmail }).first();
        await db('user_tenants').insert({
            id: uuidv4(),
            user_id: adminUser.id,
            tenant_id: tenantId,
            role: 'OWNER'
        });
        console.log('   + Admin vinculado ao Tenant Inctec');
    } else {
        console.log(`   . Tenant ${tenantSlug} já existe`);
        // Check vínculo? Pode ser excesso de zelo, mas ok.
    }

    console.log('🌱 seed_prod_init concluído.');
}

module.exports = { seed };
