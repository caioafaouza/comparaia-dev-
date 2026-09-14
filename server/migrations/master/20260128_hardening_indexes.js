exports.up = async (knex) => {
  // Extensions: log-only if missing (avoid failing when role lacks superuser)
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE NOTICE 'uuid-ossp extension not installed (skipped)';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE NOTICE 'pgcrypto extension not installed (skipped)';
      END IF;
    END;
    $$;
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status)');

  if (await knex.schema.hasTable('products')) {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
  }

  if (await knex.schema.hasTable('comparison_jobs')) {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_comp_jobs_status ON comparison_jobs(status)');
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_comp_jobs_created_at ON comparison_jobs(created_at)',
    );
  }
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_tenants_slug');
  await knex.raw('DROP INDEX IF EXISTS idx_tenants_status');
  await knex.raw('DROP INDEX IF EXISTS idx_products_category');
  await knex.raw('DROP INDEX IF EXISTS idx_comp_jobs_status');
  await knex.raw('DROP INDEX IF EXISTS idx_comp_jobs_created_at');
};
