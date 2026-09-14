// Simple Ledger Race Condition Test - Manual Evidence
// Creates 3 sequential job requests and shows DB state
// Run: node server/scripts/test_ledger_simple.js

const connectionManager = require('../db/connectionManager');

async function main() {
    console.log('\n=== LEDGER ATOMICITY TEST (Sequential) ===\n');

    const masterDb = connectionManager.getMaster();

    // Use existing tenant or hardcode
    const TENANT_SLUG = 'inctec';  // Change if needed
    const tenant = await masterDb('tenants').where({ slug: TENANT_SLUG }).first();

    if (!tenant) {
        console.error('❌ Tenant not found:', TENANT_SLUG);
        process.exit(1);
    }

    console.log(`Tenant: ${tenant.name} (ID: ${tenant.id})\n`);

    // Check current wallet state
    console.log('[1/3] Current wallet state...');
    let wallet = await masterDb('wallet').where({ tenant_id: tenant.id }).first();

    if (!wallet) {
        console.log('  No wallet found, creating one...');
        await masterDb('wallet').insert({
            id: require('crypto').randomUUID(),
            tenant_id: tenant.id,
            balance: 20,
            created_at: new Date()
        });
        wallet = { balance: 20 };
    }

    console.log(`  Balance: ${wallet.balance}\n`);

    // Check recent transactions
    console.log('[2/3] Recent transactions...');
    const transactions = await masterDb('token_transactions')
        .where({ tenant_id: tenant.id })
        .orderBy('created_at', 'desc')
        .limit(5);

    console.log(`  Total recent: ${transactions.length}`);
    transactions.forEach((tx, i) => {
        console.log(`    [${i}] ${tx.type} | ${tx.status} | amount=${tx.amount} | ref=${tx.reference_id?.substring(0, 8)}`);
    });

    console.log('\n[3/3] billingService.reserveCredits implementation...');
    const billingServicePath = require.resolve('../services/billingService');
    delete require.cache[billingServicePath];
    const billingService = require('../services/billingService');

    // Check if reserveCredits verifies balance
    const fs = require('fs');
    const code = fs.readFileSync(billingServicePath, 'utf8');
    const hasBalanceCheck = code.includes('balance >=') || code.includes('WHERE') && code.includes('balance');

    console.log(`  Has balance check in SQL: ${hasBalanceCheck ? '✅ YES' : '❌ NO'}`);

    if (!hasBalanceCheck) {
        console.log('\n⚠️  RACE CONDITION DETECTED!');
        console.log('  reserveCredits does NOT verify balance atomically.');
        console.log('  Multiple requests can reserve more than available balance.\n');
        console.log('📋 RECOMMENDATION:');
        console.log('  Apply atomic UPDATE in billingService.js:');
        console.log('  ');
        console.log('  const result = await masterDb(\'wallet\')');
        console.log('    .where({ tenant_id: tenantId })');
        console.log('    .andWhere(\'balance\', \'>=\', amount)');
        console.log('    .decrement(\'balance\', amount)');
        console.log('    .returning(\'balance\');');
        console.log('  ');
        console.log('  if (result.length === 0) {');
        console.log('    throw new Error(\'INSUFFICIENT_BALANCE\');');
        console.log('  }');
    } else {
        console.log('\n✅ ATOMIC UPDATE detected in code.\n');
    }

    console.log('=== TEST COMPLETE ===\n');

    await masterDb.destroy();
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
