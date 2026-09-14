exports.up = async function (knex) {
  const hasTenants = await knex.schema.hasTable('tenants');
  if (hasTenants) {
    const hasCnpj = await knex.schema.hasColumn('tenants', 'cnpj');
    if (hasCnpj) {
      await knex.raw("UPDATE tenants SET cnpj = regexp_replace(cnpj, '\\\\D', '', 'g') WHERE cnpj IS NOT NULL");
      await knex.raw(
        "CREATE UNIQUE INDEX IF NOT EXISTS tenants_cnpj_digits_uniq ON tenants ((regexp_replace(cnpj, '\\\\D', '', 'g'))) WHERE cnpj IS NOT NULL AND regexp_replace(cnpj, '\\\\D', '', 'g') <> ''"
      );
    }
  }

  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    await knex.raw("UPDATE users SET email = lower(email) WHERE email IS NOT NULL");
    await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS master_users_email_lower_uniq ON users (lower(email))");
  }
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS tenants_cnpj_digits_uniq');
  await knex.raw('DROP INDEX IF EXISTS master_users_email_lower_uniq');
};
