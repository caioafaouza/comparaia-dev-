const connectionManager = require('../db/connectionManager');

async function main() {
    console.log('DEBUG: Reading token_plans...');
    try {
        const db = connectionManager.getMaster();
        const plan = await db('token_plans').where({ slug: 'free' }).first();
        console.log('PLAN:', plan);
        console.log('DEBUG: Read OK');
        await connectionManager.destroy();
    } catch (e) {
        console.error('DEBUG: Read FAILED', e);
        process.exit(1);
    }
}
main();
