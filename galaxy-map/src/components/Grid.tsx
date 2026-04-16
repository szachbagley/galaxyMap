  import { useState, Fragment } from 'react';
  import { useAppContext } from '../context/AppContext';
  import { GridCell } from './GridCell.tsx';
  import { ScanLine } from './ScanLine.tsx';
  import type { System, GridColumn, GridRow } from '../types';
  import galaxyBg from '../assets/galaxy-map-background.png';

  const COLS: GridColumn[] = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'];
  const ROWS: GridRow[] = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];

  export function Grid() {
    const { state, dispatch } = useAppContext();
    const [hoveredCol, setHoveredCol] = useState<GridColumn | null>(null);
    const [hoveredRow, setHoveredRow] = useState<GridRow | null>(null);

    // Build a lookup map using string keys to avoid object reference equality issues - Claude
    const gridMap = new Map<string, { count: number; systems: System[] }>();
    for (const system of state.systems) {
      const key = `${system.gridCoordinate.col}-${system.gridCoordinate.row}`;
      if (!gridMap.has(key)) {
        gridMap.set(key, { count: 0, systems: [] });
      }
      const entry = gridMap.get(key) ?? { count: 0, systems: [] };
      entry.count += 1;
      entry.systems.push(system);
    }

    if (state.uiState.error) {
      return (
        <div className="grid-wrapper">
          <div className="grid-status">
            <div className="grid-status__error">SIGNAL LOST: {state.uiState.error}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid-wrapper">
      {state.uiState.loading && (
        <div className="grid-status">
          <ScanLine text="RECEIVING TRANSMISSIONS&hellip;" />
        </div>
      )}
      <div className="grid-bg" style={{ backgroundImage: `url(${galaxyBg})` }} />
      <div className="grid-container">
        {/* Empty corner cell */}
        <div className="axis-corner" />

        {/* Column headers */}
        {COLS.map((col) => (
          <div
            key={col}
            className={`axis-label col-label${
              col === state.selectedCoordinate?.col ? ' axis-selected' : ''
            }${col === hoveredCol ? ' axis-hovered' : ''}`}
          >
            {col}
          </div>
        ))}

        {/* Rows */}
        {ROWS.map((row) => (
          <Fragment key={row}>
            {/* Row header */}
            <div
              className={`axis-label row-label${
                row === state.selectedCoordinate?.row ? ' axis-selected' : ''
              }${row === hoveredRow ? ' axis-hovered' : ''}`}
            >
              {String(row).padStart(2, '0')}
            </div>

            {/* Cells */}
            {COLS.map((col) => {
              const key = `${col}-${row}`;
              const entry = gridMap.get(key);
              const isSelected =
                state.selectedCoordinate?.col === col &&
                state.selectedCoordinate?.row === row;

              return (
                <GridCell
                  key={key}
                  col={col}
                  row={row}
                  count={entry?.count ?? 0}
                  isSelected={isSelected}
                  onClick={() =>
                    dispatch({ type: 'SELECT_COORDINATE', payload: { col, row } })
                  }
                  onMouseEnter={() => {
                    setHoveredCol(col);
                    setHoveredRow(row);
                  }}
                  onMouseLeave={() => {
                    setHoveredCol(null);
                    setHoveredRow(null);
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      </div>
    );
  }