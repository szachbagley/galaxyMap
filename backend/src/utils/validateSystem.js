const VALID_COLS = new Set('CDEFGHIJKLMNOPQRSTUV'.split(''));

function validateSystemInput({ name, grid_col, grid_row }) {
  const errors = [];
  if (!name || typeof name !== 'string' || name.trim() === '')
    errors.push('name is required');
  if (!grid_col || !VALID_COLS.has(grid_col.toUpperCase()))
    errors.push('grid_col must be a letter between C and V');
  const row = parseInt(grid_row);
  if (isNaN(row) || row < 1 || row > 21)
    errors.push('grid_row must be an integer between 1 and 21');
  return errors;
}

module.exports = { validateSystemInput };
