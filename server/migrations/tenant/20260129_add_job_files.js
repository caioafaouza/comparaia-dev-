exports.up = async function (knex) {
  const hasFiles = await knex.schema.hasColumn('comparison_jobs', 'files');
  if (!hasFiles) {
    return knex.schema.alterTable('comparison_jobs', (table) => {
      table.json('files');
    });
  }
};

exports.down = async function (knex) {
  const hasFiles = await knex.schema.hasColumn('comparison_jobs', 'files');
  if (hasFiles) {
    return knex.schema.alterTable('comparison_jobs', (table) => {
      table.dropColumn('files');
    });
  }
};
