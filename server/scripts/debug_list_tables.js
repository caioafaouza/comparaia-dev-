
const connectionManager = require('../db/connectionManager');

async function run() {
    try {
        const db = connectionManager.getMaster();
        const res = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name));

        const configStructure = await db.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'system_config'");
        console.log('System Config Columns:', configStructure.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
