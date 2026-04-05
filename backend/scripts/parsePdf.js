const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, '../data/systems_raw.txt');
const OUT_PATH = path.join(__dirname, '../data/systems_parsed.json');

const SKIP_PATTERNS = [
  /^SYSTEM\s+SECTOR\s+REGION\s+GRID/i,
  /^STAR SYSTEMS OF THE GALAXY/i,
  /^Star systems are listed/i,
  /^prominent planets/i,
  /^parentheses\./i,
  /^\s*\d+\s*$/,      // Page numbers
  /^©/,               // Copyright line
  /^\s*$/,            // Blank lines
];

// Grid coordinate: one or two uppercase letters, dash, one or two digits
const GRID_PATTERN = /^([A-Z]{1,2})-(\d{1,2})$/;

// Extract all records from a single (potentially two-column) line.
// Returns an array of 0, 1, or 2 record objects.
function extractRecords(line) {
  const tokens = line.trim().split(/\s{2,}/);

  // Find all positions that are grid coordinates
  const gridIndices = tokens.reduce((acc, t, i) => {
    if (GRID_PATTERN.test(t.trim())) acc.push(i);
    return acc;
  }, []);

  if (gridIndices.length === 0) return [];

  const records = [];
  let segStart = 0;

  for (const gridIdx of gridIndices) {
    const segment = tokens.slice(segStart, gridIdx + 1);
    // segment: [name, ?sector, region, grid]
    // grid is last, region is second-to-last, name is first, sector is anything between
    if (segment.length < 3) { segStart = gridIdx + 1; continue; }

    const gridRaw = segment[segment.length - 1].trim();
    const [, col, rowStr] = gridRaw.match(GRID_PATTERN);
    const row = parseInt(rowStr, 10);

    const name = segment[0].trim();
    if (!name) { segStart = gridIdx + 1; continue; }

    const region = segment[segment.length - 2].trim() || null;
    const sectorTokens = segment.slice(1, segment.length - 2);
    const sector = sectorTokens.length > 0 ? sectorTokens.join(' ').trim() : null;

    records.push({
      name,
      sector: sector || null,
      region: region || null,
      grid_col: col,
      grid_row: row,
    });

    segStart = gridIdx + 1;
  }

  return records;
}

function run() {
  const raw = fs.readFileSync(RAW_PATH, 'utf-8');
  const lines = raw.split('\n');
  const results = [];
  const seen = new Set();

  for (const line of lines) {
    if (SKIP_PATTERNS.some(p => p.test(line))) continue;

    const records = extractRecords(line);
    for (const record of records) {
      const key = `${record.name.toLowerCase()}|${record.grid_col}-${record.grid_row}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(record);
      }
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Parsed ${results.length} systems → ${OUT_PATH}`);
}

run();
