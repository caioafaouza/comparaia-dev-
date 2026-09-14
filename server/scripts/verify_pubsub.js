const Redis = require('ioredis');
const config = require('../config/env');

const CHANNEL = 'llm_config_updated';

async function verify() {
    console.log('📡 Verifying Redis Pub/Sub...');

    // 1. Publisher
    const pub = new Redis(config.redis);
    // 2. Subscriber
    const sub = new Redis(config.redis);

    // Fail fast
    const timeout = setTimeout(() => {
        console.error('❌ Timeout waiting for message');
        process.exit(1);
    }, 5000);

    try {
        await sub.subscribe(CHANNEL);
        console.log(`✅ Subscribed to ${CHANNEL}`);

        sub.on('message', (channel, message) => {
            if (channel === CHANNEL && message === 'ping') {
                console.log('✅ Received PING message');
                clearTimeout(timeout);
                process.exit(0);
            }
        });

        console.log(`📤 Publishing to ${CHANNEL}...`);
        await pub.publish(CHANNEL, 'ping');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('NOPERM')) {
            console.error('🚨 Permission Denied! Check ACLs.');
        }
        process.exit(1);
    }
}

verify();
