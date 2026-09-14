
const bcrypt = require('bcryptjs');
const db = require('../server/db/connectionManager');
// Mocking services/provisioningService structure effectively by using the DB directly to simulate the state before and after.
// But ideally I should import the actual service.
// Let's try to import the service if possible, or replicate the logic exactly to test the logic branch.

const provisioningService = require('../server/services/provisioningService');
const crypto = require('crypto');

async function testProvisioningFlow() {
    console.log(">>> EXTRACTING DB CONFIG...");
    // Ensure DB connection
    const masterDb = db.getMaster();

    const TEST_EMAIL = `test_prov_${Date.now()}@flow.com`;
    const OLD_PASS = 'old_password_123';
    const NEW_PASS = 'new_password_456';

    try {
        console.log(">>> SETUP: Creating user with OLD password...");
        const salt = await bcrypt.genSalt(10);
        const oldHash = await bcrypt.hash(OLD_PASS, salt);

        // delete if exists
        await masterDb('users').where({ email: TEST_EMAIL }).del();

        const [userId] = await masterDb('users').insert({
            id: crypto.randomUUID(),
            name: 'Test Setup User',
            email: TEST_EMAIL,
            password: oldHash, // OLD PASSWORD
            role: 'ADMIN',
            status: 'ACTIVE'
        }).returning('id');

        console.log(`>>> SETUP COMPLETE. User ${TEST_EMAIL} created with ID ${userId.id || userId}`);

        // VERIFY OLD LOGIN WORKS
        const check1 = await masterDb('users').where({ email: TEST_EMAIL }).first();
        const valid1 = await bcrypt.compare(OLD_PASS, check1.password);
        console.log(`>>> PRE-CHECK: Login with OLD password is ${valid1 ? 'VALID' : 'INVALID'}`);

        console.log(">>> ACTION: Running registerTenant with NEW password...");

        await provisioningService.registerTenant({
            name: `Tenant_${Date.now()}`,
            slug: `tenant-test-${Date.now()}`,
            adminName: 'Test Setup User (Updated)',
            email: TEST_EMAIL,
            password: NEW_PASS,
            plan: 'STARTER',
            cnpj: '00000000000000',
            phone: '1199999999',
            sector: 'Tech',
            purchaseVolume: '10k'
        });

        console.log(">>> ACTION COMPLETE. Verifying database state...");

        // VERIFY NEW LOGIN WORKS
        const check2 = await masterDb('users').where({ email: TEST_EMAIL }).first();
        const validOld = await bcrypt.compare(OLD_PASS, check2.password);
        const validNew = await bcrypt.compare(NEW_PASS, check2.password);

        console.log(`>>> POST-CHECK: Login with OLD password is ${validOld ? 'VALID (Unexpected)' : 'INVALID (Expected)'}`);
        console.log(`>>> POST-CHECK: Login with NEW password is ${validNew ? 'VALID (Expected)' : 'INVALID (Unexpected)'}`);

        if (validNew && !validOld) {
            console.log(">>> SUCCESS: Password was updated correctly during provisioning.");
        } else {
            console.error(">>> FAILURE: Password update failed.");
            process.exit(1);
        }

    } catch (e) {
        console.error(">>> ERROR:", e);
        process.exit(1);
    } finally {
        await masterDb.destroy();
    }
}

testProvisioningFlow();
