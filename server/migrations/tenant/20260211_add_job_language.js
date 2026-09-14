exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('comparison_jobs');
  if (!hasTable) return;

  const hasLanguage = await knex.schema.hasColumn('comparison_jobs', 'language');
  if (!hasLanguage) {
    await knex.schema.alterTable('comparison_jobs', (table) => {
      table.string('language').defaultTo('pt');
    });
  }
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('comparison_jobs');
  if (!hasTable) return;

  const hasLanguage = await knex.schema.hasColumn('comparison_jobs', 'language');
  if (hasLanguage) {
    await knex.schema.alterTable('comparison_jobs', (table) => {
      table.dropColumn('language');
    });
  }
};
