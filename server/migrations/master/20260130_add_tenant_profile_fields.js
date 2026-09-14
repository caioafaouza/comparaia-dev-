exports.up = async function (knex) {
  const columns = [
    { name: 'cnpj', type: (t) => t.string('cnpj') },
    { name: 'phone', type: (t) => t.string('phone') },
    { name: 'sector', type: (t) => t.string('sector') },
    { name: 'purchase_volume', type: (t) => t.string('purchase_volume') },
    { name: 'custom_domain', type: (t) => t.string('custom_domain') },
    { name: 'brand_color', type: (t) => t.string('brand_color') },
    { name: 'logo_url', type: (t) => t.text('logo_url') },
  ];

  for (const column of columns) {
    const exists = await knex.schema.hasColumn('tenants', column.name);
    if (!exists) {
      await knex.schema.alterTable('tenants', (table) => {
        column.type(table);
      });
    }
  }
};

exports.down = async function (knex) {
  const columns = [
    'logo_url',
    'brand_color',
    'custom_domain',
    'purchase_volume',
    'sector',
    'phone',
    'cnpj',
  ];

  for (const column of columns) {
    const exists = await knex.schema.hasColumn('tenants', column);
    if (exists) {
      await knex.schema.alterTable('tenants', (table) => {
        table.dropColumn(column);
      });
    }
  }
};
