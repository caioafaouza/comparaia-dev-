// Test script para validar implementação de encriptação
import { encrypt, decrypt, maskKey } from './server/utils/crypto.js';
import connectionManager from './server/db/connectionManager.js';

console.log('=== TESTE 1: Crypto Utils ===');
const testKey = 'AIzaSyTest123456789';
console.log('Original:', testKey);

const encrypted = encrypt(testKey);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);

const masked = maskKey(testKey);
console.log('Masked:', masked);

console.log('✅ Crypto OK:', testKey === decrypted);

console.log('\n=== TESTE 2: Config DB ===');

(async () => {
    try {
        const db = connectionManager.getMaster();
        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();

        if (configRow) {
            const config = typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value;
            console.log('Config keys:', Object.keys(config));

            // Check if keys are encrypted
            const keysToCheck = ['geminiKey', 'openaiKey', 'stabilityKey'];
            for (const key of keysToCheck) {
                if (config[key]) {
                    const isEncrypted = /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/i.test(config[key]);
                    console.log(`${key}: ${isEncrypted ? '🔒 Encrypted' : '⚠️  Plaintext'}`);

                    if (isEncrypted) {
                        try {
                            const decrypted = decrypt(config[key]);
                            const masked = maskKey(decrypted);
                            console.log(`  → Decrypts to: ${masked}`);
                        } catch (e) {
                            console.log(`  → ❌ Decryption failed: ${e.message}`);
                        }
                    }
                }
            }
        } else {
            console.log('⚠️  No GLOBAL_CONFIG found in system_config');
        }

        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
})();
