exports.up = async (knex) => {
  // Tenant migrations run in tenant schema; avoid extension creation here.
  if (await knex.schema.hasTable('products')) {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_t_products_category ON products(category)');
  }
  if (await knex.schema.hasTable('comparison_jobs')) {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_t_jobs_status ON comparison_jobs(status)');
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_t_jobs_created_at ON comparison_jobs(created_at)',
    );
  }
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_t_products_category');
  await knex.raw('DROP INDEX IF EXISTS idx_t_jobs_status');
  await knex.raw('DROP INDEX IF EXISTS idx_t_jobs_created_at');
};
