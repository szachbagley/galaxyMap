import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { System, GridColumn, GridRow } from '../types';

const COLS: GridColumn[] = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'];

interface NearbyCell {
  col: GridColumn | null;
  row: GridRow | null;
  count: number;
  isCenter: boolean;
}

interface NearbyGridProps {
  system: System;
  nearbySystems: System[];
}

export function NearbyGrid({ system, nearbySystems }: NearbyGridProps) {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();

  const centerCol = system.gridCoordinate.col;
  const centerRow = system.gridCoordinate.row;
  const colIdx = COLS.indexOf(centerCol);

  const countMap = new Map<string, number>();
  for (const s of nearbySystems) {
    const key = `${s.gridCoordinate.col}-${s.gridCoordinate.row}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const cells: NearbyCell[][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const rowCells: NearbyCell[] = [];
    const r = centerRow + dr;
    for (let dc = -1; dc <= 1; dc++) {
      const ci = colIdx + dc;
      const isCenter = dr === 0 && dc === 0;

      if (ci < 0 || ci >= COLS.length || r < 1 || r > 21) {
        rowCells.push({ col: null, row: null, count: 0, isCenter });
      } else {
        const col = COLS[ci];
        const row = r as GridRow;
        const key = `${col}-${row}`;
        rowCells.push({ col, row, count: countMap.get(key) ?? 0, isCenter });
      }
    }
    cells.push(rowCells);
  }

  function handleCellClick(cell: NearbyCell) {
    if (!cell.col || !cell.row) return;
    dispatch({ type: 'SELECT_COORDINATE', payload: { col: cell.col, row: cell.row } });
    navigate('/');
  }

  return (
    <div className="nearby">
      {cells.map((rowCells, ri) => (
        <div key={ri} className="nearby__row">
          {rowCells.map((cell, ci) => {
            const isOutOfBounds = cell.col === null;
            const classes = [
              'nearby__cell',
              cell.isCenter ? 'nearby__cell--center' : '',
              isOutOfBounds ? 'nearby__cell--disabled' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={ci}
                className={classes}
                onClick={() => handleCellClick(cell)}
              >
                {isOutOfBounds ? (
                  <span className="nearby__empty">&mdash;</span>
                ) : (
                  <>
                    <span className="nearby__coord">
                      {cell.col}-{String(cell.row).padStart(2, '0')}
                    </span>
                    <span className={`nearby__count${cell.isCenter ? ' nearby__count--center' : ''}`}>
                      {cell.count}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
