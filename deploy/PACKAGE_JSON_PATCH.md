# package.json Scripts Patch

Add or update these scripts in your `server/package.json`:

```json
{
  "scripts": {
    "start": "node index.js",
    "start:prod": "NODE_ENV=production node index.js",
    "start:processor": "node processorRunner.js",
    
    "migrate:master": "knex migrate:latest --env development",
    "migrate:master:prod": "knex migrate:latest --env production",
    "migrate:rollback": "knex migrate:rollback --env development",
    
    "seed:direct": "node scripts/seed_direct_sql.cjs",
    
    "test:pubsub": "node scripts/verify_pubsub.js",
    "test:ledger": "node tests/ledger.concurrency.simple.js",
    "test:prod-ready": "node scripts/reset_database_full.cjs",
    
    "verify:schemas": "node scripts/verify_master_schema.cjs && node scripts/verify_tenant_schema.cjs",
    
    "provision:qa": "node scripts/provision_qa_tenant.cjs",
    
    "reset:full": "node scripts/reset_database_full.cjs"
  }
}
```

## Notes

- `start:prod`: Use for manual testing in production mode
- `migrate:master:prod`: Run migrations with production config
- `test:prod-ready`: **NEVER run in production** (destroys data)
- `reset:full`: **NEVER run in production** (destroys data)
- `seed:direct`: Use only in staging/test environments
- `provision:qa`: Use only in staging/test environments
