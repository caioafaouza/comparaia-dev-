const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_ADMIN_PASS = process.env.REDIS_ADMIN_PASSWORD || '8Tn9pHc7vQ2@Gm6#Kf3!rZ5xYp1$Ld8'; // Default fallback (mas deve vir do ENV)

// Configuração do ACL
const APP_USER = process.env.REDIS_USERNAME || 'app';
const APP_PASS = process.env.REDIS_PASSWORD; // Senha atual do app
const APP_CHANNELS = '&llm_config_updated'; // Restrição de Canal (Legacy era &*)

async function applyAcl() {
    console.log('🔐 Applying Redis ACLs...');

    if (!APP_PASS) {
        console.error('❌ REDIS_PASSWORD not found in env. Cannot configure ACL.');
        process.exit(1);
    }

    const redis = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        username: 'default',
        password: REDIS_ADMIN_PASS,
    });

    try {
        // Verificar conexão
        await redis.ping();
        console.log('✅ Connected to Redis as Admin');

        // Definir ACL Rule
        // +@read +@write +@connection +@fast ... simplificado em comandos explicitos ou categorias
        // Least privilege: 
        // keys: ~* (acesso a todas as chaves? idealmente prefixado, mas app usa muitas configs)
        // commands: +get +set +del +exists +expire +ttl +mget +mset +ping +info +publish +subscribe +unsubscribe

        // NOTA: O user pediu "cache ops: get/set/del...", health, pubsub.
        const ruleParts = [
            'on',
            'reset', // Garantir estado limpo
            `>${APP_PASS}`, // Password
            '~*', // Keys
            '+get', '+set', '+del', '+exists', '+expire', '+ttl', '+mget', '+mset', // Cache basic
            '+ping', '+info', // Health
            '+publish', '+subscribe', '+unsubscribe', // PubSub commands
            APP_CHANNELS, // Channel restriction
            '-@dangerous', '-config', '-flushdb', '-flushall', '-keys' // Explicit deny
        ];

        console.log(`📜 Rules for user '${APP_USER}':`, ruleParts.map(r => r.startsWith('>') ? '>***' : r).join(' '));

        const result = await redis.acl('SETUSER', APP_USER, ...ruleParts);
        console.log(`✅ ACL SETUSER result: ${result}`);

        // Verify
        const userDetails = await redis.acl('GETUSER', APP_USER);
        console.log('🧐 Verified ACL:', userDetails);

    } catch (error) {
        console.error('❌ Failed to apply ACL:', error.message);
        if (error.message.includes('WRONGPASS')) {
            console.error('   -> Check REDIS_ADMIN_PASSWORD in .env');
        }
        process.exit(1);
    } finally {
        redis.disconnect();
    }
}

applyAcl();
