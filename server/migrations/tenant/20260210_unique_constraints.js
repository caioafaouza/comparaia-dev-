exports.up = async function (knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    await knex.raw("UPDATE users SET email = lower(email) WHERE email IS NOT NULL");
    await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_email_lower_uniq ON users (lower(email))");
  }
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS tenant_users_email_lower_uniq');
};
