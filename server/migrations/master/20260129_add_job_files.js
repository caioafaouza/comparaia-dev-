exports.up = function (knex) {
  return knex.schema.alterTable('comparison_jobs', (table) => {
    table.json('files');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('comparison_jobs', (table) => {
    table.dropColumn('files');
  });
};
