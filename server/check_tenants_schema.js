
require('dotenv').config();
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        const db = connectionManager.getMaster();
        const res = await db.raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'");
        console.log('Tenants Table Columns:', res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
