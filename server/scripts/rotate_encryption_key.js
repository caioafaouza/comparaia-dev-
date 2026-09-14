// KEY ROTATION SCRIPT - Dual-key support (old + new)
// Usage: OLD_KEY=xxx NEW_KEY=yyy node rotate_encryption_key.js

const connectionManager = require('./db/connectionManager');

// Dual-key crypto functions
function encryptWithKey(plaintext, secret) {
    const crypto = require('crypto');
    if (!plaintext) return null;

    let key;
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
        key = Buffer.from(secret, 'hex');
    } else {
        key = crypto.createHash('sha256').update(secret).digest();
    }

    const iv = crypto.randomBytes(12); // GCM standard
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

function decryptWithKey(ciphertext, secret) {
    const crypto = require('crypto');
    if (!ciphertext) return null;

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        // Plaintext
        return ciphertext;
    }

    try {
        let key;
        if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
            key = Buffer.from(secret, 'hex');
        } else {
            key = crypto.createHash('sha256').update(secret).digest();
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const tag = Buffer.from(parts[2], 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (e) {
        throw new Error(`Decryption failed: ${e.message}`);
    }
}

async function rotateKeys() {
    const OLD_KEY = process.env.OLD_KEY_ENCRYPTION_SECRET || process.env.KEY_ENCRYPTION_SECRET;
    const NEW_KEY = process.env.NEW_KEY_ENCRYPTION_SECRET;

    if (!OLD_KEY) {
        console.error('❌ OLD_KEY_ENCRYPTION_SECRET not set');
        process.exit(1);
    }

    if (!NEW_KEY) {
        console.error('❌ NEW_KEY_ENCRYPTION_SECRET not set');
        console.log('Generate new key with: openssl rand -hex 32');
        process.exit(1);
    }

    console.log('[ROTATION] Starting key rotation...');
    console.log('[ROTATION] Old key:', OLD_KEY.substring(0, 10) + '***');
    console.log('[ROTATION] New key:', NEW_KEY.substring(0, 10) + '***\n');

    const db = connectionManager.getMaster();

    try {
        // Get global config
        const row = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();

        if (!row) {
            console.log('⚠️  No GLOBAL_CONFIG found. Nothing to rotate.');
            return;
        }

        const config = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        const keysToRotate = ['geminiKey', 'openaiKey', 'stabilityKey', 'claudeKey'];

        let rotated = 0;
        let skipped = 0;

        for (const keyField of keysToRotate) {
            if (!config[keyField]) {
                console.log(`  [${keyField}] Not set - skipped`);
                skipped++;
                continue;
            }

            try {
                // Decrypt with old key
                const plaintext = decryptWithKey(config[keyField], OLD_KEY);

                if (!plaintext) {
                    console.log(`  [${keyField}] Empty - skipped`);
                    skipped++;
                    continue;
                }

                // Re-encrypt with new key
                const newCiphertext = encryptWithKey(plaintext, NEW_KEY);
                config[keyField] = newCiphertext;

                console.log(`  [${keyField}] ✅ Rotated (${plaintext.substring(0, 6)}***)`);
                rotated++;
            } catch (e) {
                console.error(`  [${keyField}] ❌ Failed: ${e.message}`);
            }
        }

        // Save back
        await db('system_config')
            .where({ key: 'GLOBAL_CONFIG' })
            .update({
                value: JSON.stringify(config),
                updated_at: db.fn.now()
            });

        console.log(`\n[ROTATION] Complete: ${rotated} rotated, ${skipped} skipped`);
        console.log('[ROTATION] ✅ Don\'t forget to update KEY_ENCRYPTION_SECRET in .env to the NEW key!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Rotation failed:', error.message);
        process.exit(1);
    }
}

rotateKeys();
