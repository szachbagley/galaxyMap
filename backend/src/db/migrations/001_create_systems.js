exports.up = function (knex) {
  return knex.schema.createTable('systems', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.string('sector', 200).nullable();
    table.string('region', 100).nullable();
    table.string('grid_col', 5).notNullable();
    table.integer('grid_row').notNullable();
    table.text('description').nullable();
    table.boolean('is_user_added').defaultTo(false);
    table.timestamps(true, true);

    table.index(['grid_col', 'grid_row']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('systems');
};
