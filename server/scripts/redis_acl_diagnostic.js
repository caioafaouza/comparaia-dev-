// Redis ACL Diagnostic Script
// Tests current user permissions and identifies missing Pub/Sub grants
// Run: node server/scripts/redis_acl_diagnostic.js

const Redis = require('ioredis');

async function main() {
    console.log('\n=== REDIS ACL DIAGNOSTIC ===\n');

    // Redis connection from env
    const redisConfig = {
        host: process.env.REDIS_HOST || '72.61.35.57',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        username: process.env.REDIS_USERNAME || 'app',
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        enableReadyCheck: false,
        maxRetriesPerRequest: 1
    };

    console.log('[1/6] Connecting to Redis...');
    console.log(`  Host: ${redisConfig.host}:${redisConfig.port}`);
    console.log(`  User: ${redisConfig.username}`);

    const client = new Redis(redisConfig);

    try {
        await client.connect();
        console.log('✅ Connected\n');
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }

    // Test 1: PING
    console.log('[2/6] Testing PING...');
    try {
        const pong = await client.ping();
        console.log(`✅ PING: ${pong}\n`);
    } catch (err) {
        console.error('❌ PING failed:', err.message);
    }

    // Test 2: INFO server
    console.log('[3/6] Getting server info...');
    try {
        const info = await client.info('server');
        const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
        const mode = info.match(/redis_mode:([^\r\n]+)/)?.[1];
        console.log(`  Redis version: ${version || 'unknown'}`);
        console.log(`  Mode: ${mode || 'unknown'}`);
        console.log('✅ INFO retrieved\n');
    } catch (err) {
        console.error('❌ INFO failed:', err.message, '\n');
    }

    // Test 3: ACL WHOAMI
    console.log('[4/6] Checking current user (ACL WHOAMI)...');
    try {
        const whoami = await client.call('ACL', 'WHOAMI');
        console.log(`  Current user: ${whoami}`);
        console.log('✅ ACL WHOAMI successful\n');
    } catch (err) {
        console.error('❌ ACL WHOAMI failed:', err.message);
        console.log('  (Redis may not support ACL or user has no permission)\n');
    }

    // Test 4: ACL LIST (may fail if no permission)
    console.log('[5/6] Listing ACL rules (ACL LIST)...');
    try {
        const aclList = await client.call('ACL', 'LIST');
        console.log('  ACL rules:');
        if (Array.isArray(aclList)) {
            aclList.forEach((rule, i) => {
                // Mask passwords
                const masked = rule.replace(/>\S+/g, '>***');
                console.log(`    [${i}] ${masked}`);
            });
        } else {
            console.log('    ', String(aclList).substring(0, 200));
        }
        console.log('✅ ACL LIST successful\n');
    } catch (err) {
        console.error('❌ ACL LIST failed:', err.message);
        console.log('  (User may not have ACL permissions)\n');
    }

    // Test 5: Pub/Sub test
    console.log('[6/6] Testing Pub/Sub permissions...');

    const publisher = client.duplicate();
    const subscriber = client.duplicate();

    try {
        await publisher.connect();
        await subscriber.connect();

        const channel = 'llm_config_updated';
        let messageReceived = false;

        subscriber.on('message', (ch, msg) => {
            if (ch === channel) {
                console.log(`  ✅ SUBSCRIBE received: channel=${ch}, message=${msg}`);
                messageReceived = true;
            }
        });

        console.log(`  Subscribing to channel: ${channel}...`);
        await subscriber.subscribe(channel);
        console.log('  ✅ SUBSCRIBE successful');

        console.log('  Publishing test message...');
        const receivers = await publisher.publish(channel, 'diagnostic_test');
        console.log(`  ✅ PUBLISH successful (${receivers} receiver${receivers !== 1 ? 's' : ''})`);

        // Wait 1s for message
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (messageReceived) {
            console.log('✅ Pub/Sub working correctly!\n');
        } else {
            console.log('⚠️  Message not received (may be timing issue)\n');
        }

        await subscriber.unsubscribe(channel);
        await subscriber.quit();
        await publisher.quit();
    } catch (err) {
        console.error('❌ Pub/Sub test failed:', err.message);
        console.log('  Error code:', err.code || 'none');
        console.log('  Command:', err.command || 'none');

        if (err.message.includes('NOPERM')) {
            console.log('\n⚠️  DIAGNOSIS: User lacks Pub/Sub permissions!');
            console.log('  Required permissions:');
            console.log('    - +publish');
            console.log('    - +subscribe');
            console.log('    - &llm_config_updated (channel pattern)');
        }

        console.log('');
    }

    await client.quit();

    console.log('=== DIAGNOSTIC COMPLETE ===\n');
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
