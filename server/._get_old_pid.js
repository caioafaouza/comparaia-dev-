const { Client } = require('pg');
const client = new Client({
  host: '72.61.35.57',
  user: 'comparaia',
  password: 'ddaCxxXzJr4iCBET',
  database: 'comparaia',
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => {
  return client.query("SELECT payment_id, external_reference, id FROM billing_orders ORDER BY updated_at DESC LIMIT 5");
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}).catch(console.error);
