const knex = require('knex');
const config = require('../config/env');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// --- GUARDRAILS ---
if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_DB_NUKE !== 'true' || process.env.I_UNDERSTAND_THIS_WIPES_DATA !== 'true') {
        console.error('🚨 PRODUCTION GUARDRAIL TRIGGERED 🚨');
        console.error('You are attempting to NUKE the PRODUCTION database.');
        console.error('You must explicitly set environment variables:');
        console.error('  ALLOW_DB_NUKE=true');
        console.error('  I_UNDERSTAND_THIS_WIPES_DATA=true');
        process.exit(1);
    }
}

// Validar DB Host para evitar acidente em localhost se estiver rodando em maquina errada
// (Ajuste conforme necessidade, ou remova se for rodar localmente apontando pra remoto propositalmente)
// if (process.env.NODE_ENV === 'production' && !config.db.host.includes('db-prod')) { ... }

const db = knex({ client: 'pg', connection: config.db });
const masterMigrationsDir = path.join(__dirname, '../migrations/master');

async function resetFull() {
    const startTime = Date.now();
    console.log('🛑 INICIANDO RESET TOTAL DO BANCO DE DADOS 🛑');
    console.log(`📅 Data: ${new Date().toISOString()}`);
    console.log(`🌍 Env: ${process.env.NODE_ENV}`);
    console.log(`📂 Migrations: ${masterMigrationsDir}`);

    try {
        // 1. Drop Schema Public e Tenant Templates (se houver padrão de nome)
        console.log('🔥 [1/6] Dropping Schemas...');
        await db.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

        // Opcional: Dropar schemas de tenants se quiser limpar TUDO
        // const schemas = await db('information_schema.schemata').select('schema_name').whereILike('schema_name', 'tenant_%');
        // for (const s of schemas) { await db.raw(`DROP SCHEMA "${s.schema_name}" CASCADE`); }

        console.log('✅ Schemas limpos.');

        // 2. Run Master Migrations
        console.log('🏗️ [2/6] Running Migrations...');
        await db.migrate.latest({ directory: masterMigrationsDir });
        console.log('✅ Migrations applied.');

        // 3. Run Seeds (Plans + Admin)
        console.log('🌱 [3/6] Seeding Initial Data...');
        // Chamando script de seed externo ou executando lógica aqui
        // Vamos importar o seeder (que criaremos a seguir) para garantir coesão
        const seeder = require('./seed_prod_init');
        await seeder.seed(db);
        console.log('✅ Seeds applied.');

        // 4. Verification (Schema Introspection)
        console.log('🔍 [4/6] Verifying Schema...');
        const tablesToCheck = ['tenants', 'users', 'user_tenants', 'wallet', 'api_gateway_config'];
        for (const table of tablesToCheck) {
            const exists = await db.schema.hasTable(table);
            if (!exists) throw new Error(`❌ Critical table missing: ${table}`);
        }
        console.log('✅ Core tables verification passed.');

        // 5. Gates (Simulados ou reais se scripts existirem)
        // Em um script real de orchestrator, poderiamos chamar subprocessos.
        // Aqui faremos apenas check de conexão e health basico.
        console.log('🛡️ [5/6] Checking Health...');
        // Check Redis (se configurado)
        // Check Ledger Table integrity
        const walletCount = await db('wallet').count('* as count');
        console.log(`   Wallet count: ${walletCount[0].count}`);

        // 6. Report
        console.log('📝 [6/6] Generating Report...');
        const reportPath = path.join(__dirname, '../../test-results/PROD_READY_REPORT.md');
        // Garantir diretorio existe
        if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath), { recursive: true });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const report = `# Production Ready Report
**Date:** ${new Date().toISOString()}
**Duration:** ${duration}s
**Status:** SUCCESS
**DB Host:** ${config.db.host}

## Verification
- Migrations: OK
- Seeds: OK
- Core Tables: ${tablesToCheck.join(', ')} OK
`;
        fs.writeFileSync(reportPath, report);
        console.log(`✅ Report saved to ${reportPath}`);

        console.log('🚀 SUCCESS! Database is clean and ready.');
        process.exit(0);

    } catch (error) {
        console.error('❌ FATAL ERROR DURING RESET:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

resetFull();
