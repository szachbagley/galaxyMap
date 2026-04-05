# Star Wars Galaxy Map — Backend API Development Plan

## Overview

A Node.js/Express REST API backed by MySQL that serves star system data to the React frontend. This document covers the full build plan in sequential phases, including a dedicated strategy for transferring the PDF system data into the database.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MySQL 8.0
- **Query Builder:** Knex.js (migrations, seeding, and queries)
- **Environment Management:** dotenv
- **Dev tooling:** nodemon, ts-node (if using TypeScript)

---

## Phase 1: Project Setup

### 1.1 Initialize the Project

```
mkdir galaxy-map-api && cd galaxy-map-api
npm init -y
npm install express mysql2 knex dotenv cors
npm install --save-dev nodemon
```

### 1.2 Directory Structure

```
galaxy-map-api/
├── src/
│   ├── routes/
│   │   └── systems.js
│   ├── controllers/
│   │   └── systemsController.js
│   ├── db/
│   │   ├── knexfile.js
│   │   ├── migrations/
│   │   │   └── 001_create_systems.js
│   │   └── seeds/
│   │       └── 001_systems.js
│   └── index.js
├── scripts/
│   └── parsePdf.js
├── data/
│   └── systems_raw.txt
├── .env
└── package.json
```

### 1.3 Environment Configuration (`.env`)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=galaxy_map
PORT=3001
```

### 1.4 Entry Point (`src/index.js`)

```js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const systemsRouter = require('./routes/systems');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/systems', systemsRouter);

app.listen(process.env.PORT, () => {
  console.log(`API running on port ${process.env.PORT}`);
});
```

---

## Phase 2: Database Design and Migration

### 2.1 Knex Configuration (`src/db/knexfile.js`)

```js
require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: { directory: './migrations' },
    seeds: { directory: './seeds' },
  },
};
```

### 2.2 Systems Table Migration (`src/db/migrations/001_create_systems.js`)

```js
exports.up = function (knex) {
  return knex.schema.createTable('systems', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.string('sector', 200).nullable();       // Blank for many canon systems
    table.string('region', 100).nullable();
    table.string('grid_col', 5).notNullable();     // e.g. "J", "M", "P"
    table.integer('grid_row').notNullable();       // e.g. 8, 13, 17
    table.text('description').nullable();          // Lore/flavor text; null for seeded data
    table.boolean('is_user_added').defaultTo(false);
    table.timestamps(true, true);

    // Index for fast grid lookups (the most common query)
    table.index(['grid_col', 'grid_row']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('systems');
};
```

**Notes on schema decisions:**
- `grid_col` and `grid_row` are stored separately so the nearby-systems query can use simple integer comparison (`row BETWEEN x-1 AND x+1`) without string parsing at query time.
- `sector` is nullable — a large portion of canon systems have no listed sector.
- `description` is nullable — seeded data has no descriptions; only user-added entries or future enrichment will populate it.
- `is_user_added` distinguishes canon seed data from user entries and can be used to restrict edit/delete operations.

### 2.3 Run the Migration

```bash
npx knex migrate:latest --knexfile src/db/knexfile.js
```

---

## Phase 3: PDF Data Extraction and Seeding

This is the most involved phase. The PDF contains approximately 5,900 star systems across 61 pages, each formatted as a four-column table: **SYSTEM | SECTOR | REGION | GRID**.

### 3.1 Extract Raw Text from the PDF

Use `pdftotext` (from the poppler-utils package) to extract the PDF text while preserving layout:

```bash
# Install poppler-utils if needed
sudo apt-get install poppler-utils   # Linux
brew install poppler                 # macOS

# Extract with layout preservation
pdftotext -layout star_systems.pdf data/systems_raw.txt
```

The `-layout` flag attempts to preserve the columnar structure of the table, which makes parsing significantly more reliable than the default mode.

### 3.2 Write the Parser Script (`scripts/parsePdf.js`)

The raw text will contain lines like:

```
Bilbringi                              Inner Rim      J-8
Dorin           Deadalis    Expansion Region   J-8
Aaeton                                 Core Worlds    K-9
```

The parser needs to handle:
- Lines with all four fields (name, sector, region, grid)
- Lines missing sector (sector field is blank)
- Header rows (`SYSTEM SECTOR REGION GRID`) that must be skipped
- Page numbers and the document title line that must be skipped
- The footnote line on page 1 that must be skipped
- Pairs of records per line (the PDF uses a two-column page layout)

```js
// scripts/parsePdf.js
const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, '../data/systems_raw.txt');
const OUT_PATH = path.join(__dirname, '../data/systems_parsed.json');

// Lines to skip
const SKIP_PATTERNS = [
  /^SYSTEM\s+SECTOR\s+REGION\s+GRID/i,
  /^STAR SYSTEMS OF THE GALAXY/i,
  /^Star systems are listed/i,
  /^Star systems are listed/i,
  /^\s*\d+\s*$/,           // Page numbers
  /^©/,                    // Copyright line
  /^\s*$/,                 // Blank lines
];

// Grid coordinate pattern: one or two uppercase letters, dash, one or two digits
const GRID_PATTERN = /^([A-Z]{1,2})-(\d{1,2})$/;

function parseLine(line) {
  // A valid data line ends with a grid coordinate like "J-8" or "R-16"
  // We split from the right to find the grid, then work backwards
  const tokens = line.trim().split(/\s{2,}/);  // Split on 2+ spaces

  // Find the token matching a grid coordinate
  const gridIndex = tokens.findIndex(t => GRID_PATTERN.test(t.trim()));
  if (gridIndex === -1) return null;

  const gridRaw = tokens[gridIndex].trim();
  const [, col, rowStr] = gridRaw.match(GRID_PATTERN);
  const row = parseInt(rowStr, 10);

  // Everything before the grid is: name [sector] region
  // Region is always the token immediately before grid
  const region = tokens[gridIndex - 1]?.trim() || null;

  // Name is always the first token
  const name = tokens[0]?.trim();
  if (!name || name === '') return null;

  // Sector is whatever sits between name and region (may be absent)
  const sectorTokens = tokens.slice(1, gridIndex - 1);
  const sector = sectorTokens.length > 0 ? sectorTokens.join(' ').trim() : null;

  return { name, sector: sector || null, region: region || null, grid_col: col, grid_row: row };
}

function run() {
  const raw = fs.readFileSync(RAW_PATH, 'utf-8');
  const lines = raw.split('\n');
  const results = [];
  const seen = new Set(); // Deduplicate by name + grid

  for (const line of lines) {
    if (SKIP_PATTERNS.some(p => p.test(line))) continue;

    const record = parseLine(line);
    if (!record) continue;

    const key = `${record.name.toLowerCase()}|${record.grid_col}-${record.grid_row}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(record);
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Parsed ${results.length} systems → ${OUT_PATH}`);
}

run();
```

Run the parser and spot-check the output:

```bash
node scripts/parsePdf.js
# Should report ~5,800–5,900 systems
```

Manually verify a sample of known systems in the JSON (e.g., Coruscant at L-9, Tatooine at R-16, Hoth at K-18, Naboo at O-17) before proceeding to seeding.

### 3.3 Write the Seed File (`src/db/seeds/001_systems.js`)

```js
const systems = require('../../../data/systems_parsed.json');

exports.seed = async function (knex) {
  // Clear existing seeded data (preserves user-added rows)
  await knex('systems').where({ is_user_added: false }).delete();

  // Insert in batches of 500 to avoid hitting MySQL's max packet size
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
```

Run the seed:

```bash
npx knex seed:run --knexfile src/db/knexfile.js
```

### 3.4 Parser Validation Checklist

Before moving on, confirm the following in the output JSON:

| Check | Expected |
|---|---|
| Total record count | ~5,800–5,950 |
| No record has a null `name` | 0 nulls |
| No record has a null `grid_col` or `grid_row` | 0 nulls |
| `grid_col` values are all single or double uppercase letters | Spot check |
| `grid_row` values are all integers | Spot check |
| Coruscant → L-9 | ✓ |
| Tatooine → R-16 | ✓ |
| Hoth → K-18 | ✓ |
| Naboo → O-17 | ✓ |
| Bilbringi → J-8 | ✓ |
| Dorin → J-8 (same square as Bilbringi) | ✓ |
| Devshi → J-8 | ✓ |

If the parser misses records or miscategorizes fields, adjust the whitespace threshold in the `split(/\s{2,}/)` regex or add targeted line-specific overrides.

---

## Phase 4: API Routes and Controllers

### 4.1 Route Definitions (`src/routes/systems.js`)

```js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/systemsController');

router.get('/',                      ctrl.getAllSystems);
router.get('/grid/:col/:row',        ctrl.getSystemsByGrid);
router.get('/:id/nearby',            ctrl.getNearby);
router.get('/:id',                   ctrl.getSystemById);
router.post('/',                     ctrl.createSystem);
router.put('/:id',                   ctrl.updateSystem);
router.delete('/:id',                ctrl.deleteSystem);

module.exports = router;
```

### 4.2 Controller (`src/controllers/systemsController.js`)

```js
const knex = require('../db/knex');  // knex instance initialized with knexfile

// GET /api/systems
// Optional query params: col, row (filter to a grid square)
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
// Returns all systems in the 3x3 grid neighborhood around the system's coordinate
exports.getNearby = async (req, res) => {
  try {
    const system = await knex('systems').where({ id: req.params.id }).first();
    if (!system) return res.status(404).json({ error: 'System not found' });

    const { grid_col, grid_row } = system;

    // Convert col letter(s) to index for ±1 arithmetic
    const COL_ORDER = 'CDEFGHIJKLMNOPQRSTUV'.split('');
    const colIndex = COL_ORDER.indexOf(grid_col);

    const nearbyColIndexes = [colIndex - 1, colIndex, colIndex + 1]
      .filter(i => i >= 0 && i < COL_ORDER.length);
    const nearbyCols = nearbyColIndexes.map(i => COL_ORDER[i]);
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
    if (!name || !grid_col || !grid_row) {
      return res.status(400).json({ error: 'name, grid_col, and grid_row are required' });
    }
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
```

---

## Phase 5: Error Handling and Validation

### 5.1 Request Validation for POST/PUT

Add a validation helper to check grid coordinate constraints before hitting the database:

```js
// src/utils/validateSystem.js
const VALID_COLS = new Set('CDEFGHIJKLMNOPQRSTUV'.split(''));

function validateSystemInput({ name, grid_col, grid_row }) {
  const errors = [];
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('name is required');
  }
  if (!grid_col || !VALID_COLS.has(grid_col.toUpperCase())) {
    errors.push('grid_col must be a letter between C and V');
  }
  const row = parseInt(grid_row);
  if (isNaN(row) || row < 1 || row > 21) {
    errors.push('grid_row must be an integer between 1 and 21');
  }
  return errors;
}

module.exports = { validateSystemInput };
```

### 5.2 Global Error Handler (`src/index.js`)

Add after all route registrations:

```js
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## Phase 6: API Endpoint Reference

| Method | Endpoint | Description | Used By |
|---|---|---|---|
| GET | `/api/systems` | All systems; accepts `?col=J&row=8` | Initial data load |
| GET | `/api/systems/grid/:col/:row` | Systems in one grid square | Map click → system list |
| GET | `/api/systems/:id` | Single system details | System detail page |
| GET | `/api/systems/:id/nearby` | Systems in the 3×3 neighborhood | System detail page sidebar |
| POST | `/api/systems` | Add a user system | Add system form |
| PUT | `/api/systems/:id` | Update a user system | (Future edit form) |
| DELETE | `/api/systems/:id` | Delete a user system | (Future delete button) |

---

## Phase 7: Testing the API

Test each endpoint manually using curl or a tool like Postman/Insomnia before connecting the frontend.

```bash
# All systems in square J-8 (should return Bilbringi, Devshi, Dorin, and others)
curl http://localhost:3001/api/systems/grid/J/8

# System detail for a known ID
curl http://localhost:3001/api/systems/1

# Nearby systems for system ID 1
curl http://localhost:3001/api/systems/1/nearby

# Add a user system
curl -X POST http://localhost:3001/api/systems \
  -H "Content-Type: application/json" \
  -d '{"name":"Dagobah","sector":"Sluis","region":"Outer Rim Territories","grid_col":"M","grid_row":19}'
```

---

## Phase 8: Deployment Considerations

- Add a `start` script to `package.json`: `"start": "node src/index.js"`
- Add a `dev` script: `"dev": "nodemon src/index.js"`
- For deployment on a service like Railway or Render, use environment variables for all database credentials — never commit the `.env` file
- Set `CORS` origin to your deployed frontend URL in production rather than allowing all origins

---

## Build Order Summary

| Phase | Task | Estimated Effort |
|---|---|---|
| 1 | Project setup, folder structure, entry point | 30 min |
| 2 | Knex config, migration, run against local MySQL | 30 min |
| 3 | Extract PDF text, write and run parser, validate output, seed DB | 2–3 hrs |
| 4 | Write all routes and controller functions | 1.5 hrs |
| 5 | Validation helpers and error handler | 30 min |
| 6 | Manual endpoint testing | 30 min |
| 7 | Connect to frontend, fix any CORS or shape issues | 30 min |

The PDF parsing phase (Phase 3) is the highest-risk step and warrants the most time budget. Run the parser, inspect the JSON output carefully, and fix any systematic parsing errors before seeding. Re-running the seed is cheap — the seed file clears and re-inserts non-user rows each time.
