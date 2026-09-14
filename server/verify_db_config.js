
const connectionManager = require('./db/connectionManager');

(async () => {
    console.log('--- CHECKING SYSTEM_CONFIG ---');
    const db = connectionManager.getMaster();
    try {
        const hasTable = await db.schema.hasTable('system_config');
        console.log('Table Exists:', hasTable);
        if (hasTable) {
            const config = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
            if (config) {
                console.log('Config Found:', config.key);
                // Mask keys
                const val = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
                console.log('Provider:', val.activeAIProvider);
                console.log('OpenAI Key:', val.openaiKey ? 'Saved (Masked)' : 'Missing');
                console.log('Gemini Key:', val.geminiKey ? 'Saved (Masked)' : 'Missing');
            } else {
                console.log('Config Row Missing (GLOBAL_CONFIG)');
            }
        }
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
