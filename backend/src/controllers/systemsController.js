const knex = require('../db/knex');
const { validateSystemInput } = require('../utils/validateSystem');

const COL_ORDER = 'CDEFGHIJKLMNOPQRSTUV'.split('');

// GET /api/systems
exports.getAllSystems = async (req, res) => {
  try {
    const { col, row } = req.query;
    let query = knex('systems').select('*').orderBy('name');
    if (col) query = query.where('grid_col', col.toUpperCase());
    if (row) query = query.where('grid_row', parseInt(row));
    const systems = await query;
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/systems/grid/:col/:row
exports.getSystemsByGrid = async (req, res) => {
  try {
    const { col, row } = req.params;
    const systems = await knex('systems')
      .where({ grid_col: col.toUpperCase(), grid_row: parseInt(row) })
      .orderBy('name');
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/systems/:id
exports.getSystemById = async (req, res) => {
  try {
    const system = await knex('systems').where({ id: req.params.id }).first();
    if (!system) return res.status(404).json({ error: 'System not found' });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/systems/:id/nearby
exports.getNearby = async (req, res) => {
  try {
    const system = await knex('systems').where({ id: req.params.id }).first();
    if (!system) return res.status(404).json({ error: 'System not found' });

    const { grid_col, grid_row } = system;
    const colIndex = COL_ORDER.indexOf(grid_col);
    const nearbyCols = [colIndex - 1, colIndex, colIndex + 1]
      .filter(i => i >= 0 && i < COL_ORDER.length)
      .map(i => COL_ORDER[i]);
    const rowMin = Math.max(1, grid_row - 1);
    const rowMax = Math.min(21, grid_row + 1);

    const nearby = await knex('systems')
      .whereIn('grid_col', nearbyCols)
      .whereBetween('grid_row', [rowMin, rowMax])
      .orderBy(['grid_col', 'grid_row', 'name']);

    res.json(nearby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/systems
exports.createSystem = async (req, res) => {
  try {
    const { name, sector, region, grid_col, grid_row, description } = req.body;
    const errors = validateSystemInput({ name, grid_col, grid_row });
    if (errors.length) return res.status(400).json({ errors });
    const [id] = await knex('systems').insert({
      name,
      sector: sector || null,
      region: region || null,
      grid_col: grid_col.toUpperCase(),
      grid_row: parseInt(grid_row),
      description: description || null,
      is_user_added: true,
    });
    const created = await knex('systems').where({ id }).first();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/systems/:id  (user-added only)
exports.updateSystem = async (req, res) => {
  try {
    const system = await knex('systems').where({ id: req.params.id }).first();
    if (!system) return res.status(404).json({ error: 'System not found' });
    if (!system.is_user_added) {
      return res.status(403).json({ error: 'Cannot edit canon systems' });
    }
    const { name, sector, region, grid_col, grid_row, description } = req.body;
    const errors = validateSystemInput({ name, grid_col, grid_row });
    if (errors.length) return res.status(400).json({ errors });
    await knex('systems').where({ id: req.params.id }).update({
      name,
      sector: sector || null,
      region: region || null,
      grid_col: grid_col?.toUpperCase(),
      grid_row: grid_row ? parseInt(grid_row) : undefined,
      description: description || null,
    });
    const updated = await knex('systems').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/systems/:id  (user-added only)
exports.deleteSystem = async (req, res) => {
  try {
    const system = await knex('systems').where({ id: req.params.id }).first();
    if (!system) return res.status(404).json({ error: 'System not found' });
    if (!system.is_user_added) {
      return res.status(403).json({ error: 'Cannot delete canon systems' });
    }
    await knex('systems').where({ id: req.params.id }).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
