
const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard is 12 bytes (96 bits)
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

// Get key from env
const getKey = () => {
    const secret = config.security.cryptoKey;
    if (!secret) {
        throw new Error('KEY_ENCRYPTION_SECRET not set');
    }
    // Ensure key is 32 bytes (if hex provided, parse it, else hash it)
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
        return Buffer.from(secret, 'hex');
    }
    return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = (plaintext) => {
    if (!plaintext) return null;
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: iv:encrypted:tag
    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
};

const decrypt = (ciphertext) => {
    if (!ciphertext) return null;

    // Check if it matches encrypted format
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        // SECURITY: Do NOT return plaintext in production
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Invalid encrypted format in production');
        }
        // Development: warn and return plaintext for migration
        console.warn('[CRYPTO] Plaintext detected (migration mode):', ciphertext.substring(0, 10) + '***');
        return ciphertext;
    }

    try {
        const key = getKey();
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const tag = Buffer.from(parts[2], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (e) {
        console.error('[CRYPTO] Decryption failed:', e.message);
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Decryption failed');
        }
        return null; // Fail safe dev only
    }
};

const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `sk-***${key.slice(-4)}`;
};

module.exports = {
    encrypt,
    decrypt,
    maskKey
};
