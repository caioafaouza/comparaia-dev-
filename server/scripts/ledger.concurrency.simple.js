const knex = require('knex');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');

// Configuração Isolada
const db = knex({ client: 'pg', connection: config.db });

async function runConcurrencyTest() {
    console.log('💰 Ledger Concurrency Gate Started');

    const tenantId = uuidv4();
    const walletId = uuidv4();

    try {
        // 1. Setup Wallet (QA Tenant Dummy)
        // Precisamos de um tenant válido para FKs?
        // Se FKs forem estritas, precisamos criar um tenant.
        // Vamos assumir que reset_prod.js criou o tenant 'inctec'. Vamos usar ele ou criar um dummy rapido?
        // Melhor usar o 'inctec' se existir, ou criar um 'qatest' se não.
        // Para simplificar e não poluir, vamos tentar criar um tenant temporario.

        // Create Temporary Tenant
        await db('tenants').insert({
            id: tenantId,
            name: 'QA Concurrency',
            slug: `qa-${Date.now()}`,
            db_host: config.db.host,
            db_name: config.db.database,
            db_user: config.db.user,
            db_password: config.db.password,
            status: 'ACTIVE'
        });

        // Create Wallet with Balance 20
        await db('wallet').insert({
            id: walletId,
            tenant_id: tenantId,
            balance: 20.00,
            currency: 'BRL'
        });
        console.log('   Setup: Wallet created with 20.00');

        // 2. Simulate 3 concurrent charges of 10.00 
        // Only 2 should succeed. 1 should fail.
        // Na verdade, se o saldo for 20, e cada charge for 10.
        // Charge 1: Sucesso (Saldo 10)
        // Charge 2: Sucesso (Saldo 0)
        // Charge 3: Falha (Saldo Insuficiente)

        const charge = async (idx) => {
            // Simples transação de débito
            return db.transaction(async trx => {
                const wallet = await trx('wallet').where({ id: walletId }).forUpdate().first();
                if (wallet.balance >= 10) {
                    await trx('wallet').where({ id: walletId }).decrement('balance', 10);
                    await trx('token_transactions').insert({
                        id: uuidv4(),
                        tenant_id: tenantId,
                        amount: -10,
                        type: 'USAGE',
                        description: `Charge ${idx}`,
                        created_at: new Date()
                    });
                    return { idx, success: true };
                } else {
                    return { idx, success: false, reason: 'Insufficient funds' };
                }
            });
        };

        console.log('   Running 3 concurrent charges...');
        const results = await Promise.all([charge(1), charge(2), charge(3)]);

        // 3. Validation
        const successes = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).length;

        const finalWallet = await db('wallet').where({ id: walletId }).first();
        console.log(`   Results: ${successes} Success, ${failures} Fail. Final Balance: ${finalWallet.balance}`);

        if (successes === 2 && failures === 1 && Number(finalWallet.balance) === 0) {
            console.log('✅ Ledger Gate PASSED');
            // Cleanup
            await db('token_transactions').where({ tenant_id: tenantId }).del();
            await db('wallet').where({ id: walletId }).del();
            await db('tenants').where({ id: tenantId }).del();
            process.exit(0);
        } else {
            console.error('❌ Ledger Gate FAILED');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Unhandled Error:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

runConcurrencyTest();
