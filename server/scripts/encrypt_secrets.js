
const connectionManager = require('../db/connectionManager');
const { encrypt } = require('../utils/crypto');

const isEncrypted = (text) => {
    if (!text) return false;
    // Basic check for iv:ciphertext:tag format (hex)
    return /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/i.test(text);
};

const run = async () => {
    try {
        console.log('Starting encryption backfill...');
        const db = connectionManager.getMaster();

        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
        if (!configRow || !configRow.value) {
            console.log('No global config found.');
            process.exit(0);
        }

        let config = typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value;
        let modified = false;

        const keysToSecure = ['geminiKey', 'openaiKey', 'stabilityKey'];

        for (const key of keysToSecure) {
            const value = config[key];
            if (value && value.length > 5 && !isEncrypted(value)) {
                console.log(`Encrypting ${key}...`);
                config[key] = encrypt(value);
                modified = true;
            } else if (value) {
                console.log(`${key} is already encrypted or empty.`);
            }
        }

        if (modified) {
            await db('system_config').where({ key: 'GLOBAL_CONFIG' }).update({
                value: JSON.stringify(config),
                updated_at: new Date()
            });
            console.log('Configuration updated with encrypted keys.');
        } else {
            console.log('No changes needed.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

run();
