import { useParams, Link } from 'react-router-dom';
import { useMemo, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getSystemById, getNearbySystems } from '../api';
import { NearbyGrid } from '../components/NearbyGrid';
import { ScanLine } from '../components/ScanLine';
import type { System, GridColumn, GridRow } from '../types';

const COLS: GridColumn[] = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'];

export function SystemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useAppContext();
  const [apiSystem, setApiSystem] = useState<System | null>(null);
  const [apiNearby, setApiNearby] = useState<System[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextSystem = useMemo(() => {
    if (!id || state.systems.length === 0) return null;
    return state.systems.find(s => s.id === Number(id)) ?? null;
  }, [id, state.systems]);

  const system = contextSystem ?? apiSystem;

  // Fallback: fetch from API if context hasn't loaded yet (deep link / refresh)
  useEffect(() => {
    if (contextSystem || !id) return;
    if (state.systems.length > 0) return;
    getSystemById(id)
      .then(setApiSystem)
      .catch(err => setError(err.message));
    getNearbySystems(id)
      .then(setApiNearby)
      .catch(() => {});
  }, [id, contextSystem, state.systems.length]);

  // Sync context so back-nav highlights the right cell
  useEffect(() => {
    if (system) {
      dispatch({ type: 'SELECT_SYSTEM', payload: system });
      dispatch({ type: 'SELECT_COORDINATE', payload: system.gridCoordinate });
    }
    return () => { dispatch({ type: 'CLEAR_SYSTEM' }); };
  }, [system, dispatch]);

  // Derive nearby systems from context
  const nearbySystems = useMemo(() => {
    if (apiNearby) return apiNearby;
    if (!system || state.systems.length === 0) return [];

    const col = system.gridCoordinate.col;
    const row = system.gridCoordinate.row;
    const colIdx = COLS.indexOf(col);

    const neighborCols = new Set<GridColumn>();
    if (colIdx > 0) neighborCols.add(COLS[colIdx - 1]);
    neighborCols.add(col);
    if (colIdx < COLS.length - 1) neighborCols.add(COLS[colIdx + 1]);

    const neighborRows = new Set<GridRow>();
    if (row > 1) neighborRows.add((row - 1) as GridRow);
    neighborRows.add(row);
    if (row < 21) neighborRows.add((row + 1) as GridRow);

    return state.systems.filter(s =>
      neighborCols.has(s.gridCoordinate.col) &&
      neighborRows.has(s.gridCoordinate.row)
    );
  }, [system, state.systems, apiNearby]);

  if (state.uiState.loading && !system) {
    return (
      <div className="detail">
        <ScanLine text="ACCESSING ARCHIVES&hellip;" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail">
        <div className="detail__error">TRANSMISSION ERROR: {error}</div>
        <Link to="/" className="detail__back">&lt; GALAXY MAP</Link>
      </div>
    );
  }

  if (!system && state.systems.length > 0) {
    return (
      <div className="detail">
        <div className="detail__error">SYSTEM NOT FOUND IN ARCHIVES</div>
        <Link to="/" className="detail__back">&lt; GALAXY MAP</Link>
      </div>
    );
  }

  if (!system) return null;

  const padRow = String(system.gridCoordinate.row).padStart(2, '0');
  const gridRef = `${system.gridCoordinate.col}-${padRow} \u00B7 ${system.region}`;

  return (
    <div className="detail">
      <Link to="/" className="detail__back">&lt; GALAXY MAP</Link>

      <div className="detail__header">
        <div className="detail__header-left">
          <h1 className="detail__name">{system.name}</h1>
          <div className="detail__grid-ref">{gridRef}</div>
        </div>
        <span className={`detail__badge detail__badge--${system.isUserAdded ? 'added' : 'canon'}`}>
          {system.isUserAdded ? 'ADDED' : 'CANON'}
        </span>
      </div>

      <div className="detail__fields">
        <div className="detail__field">
          <span className="detail__label">SECTOR</span>
          {system.sector
            ? <span className="detail__value">{system.sector}</span>
            : <span className="detail__value--null">&mdash; UNKNOWN &mdash;</span>
          }
        </div>
        <div className="detail__field">
          <span className="detail__label">REGION</span>
          <span className="detail__value">{system.region}</span>
        </div>
        <div className="detail__field">
          <span className="detail__label">GRID COL</span>
          <span className="detail__value">{system.gridCoordinate.col}</span>
        </div>
        <div className="detail__field">
          <span className="detail__label">GRID ROW</span>
          <span className="detail__value">{padRow}</span>
        </div>
        <div className="detail__field detail__field--description">
          <span className="detail__label">DESCRIPTION</span>
          {system.description
            ? <span className="detail__value detail__value--description">{system.description}</span>
            : <span className="detail__value--null">NO DATA ON RECORD.</span>
          }
        </div>
      </div>

      {system.isUserAdded && (
        <div className="detail__controls">
          <button className="detail__btn detail__btn--edit">EDIT SYSTEM</button>
          <button className="detail__btn detail__btn--delete">DELETE SYSTEM</button>
        </div>
      )}

      <div className="detail__nearby">
        <div className="detail__nearby-title">NEARBY GRID SQUARES</div>
        <NearbyGrid system={system} nearbySystems={nearbySystems} />
      </div>
    </div>
  );
}
