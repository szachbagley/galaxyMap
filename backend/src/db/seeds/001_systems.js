const systems = require('../../../data/systems_parsed.json');

exports.seed = async function (knex) {
  await knex('systems').where({ is_user_added: false }).delete();

  const BATCH_SIZE = 500;
  for (let i = 0; i < systems.length; i += BATCH_SIZE) {
    const batch = systems.slice(i, i + BATCH_SIZE).map(s => ({
      ...s,
      description: null,
      is_user_added: false,
    }));
    await knex('systems').insert(batch);
  }

  console.log(`Seeded ${systems.length} systems.`);
};
