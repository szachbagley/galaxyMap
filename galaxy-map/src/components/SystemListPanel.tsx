import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { System } from '../types';

export function SystemListPanel() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const coord = state.selectedCoordinate;

  const systems = useMemo(() => {
    if (!coord) return [];
    return state.systems
      .filter(
        (s) =>
          s.gridCoordinate.col === coord.col &&
          s.gridCoordinate.row === coord.row
      )
      .sort((a, b) => {
        if (a.isUserAdded !== b.isUserAdded) return a.isUserAdded ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [state.systems, coord]);

  if (!coord) {
    return (
      <aside className="panel">
        <div className="panel__header">
          <span className="panel__grid-ref">SYSTEM LIST</span>
        </div>
        <div className="panel__empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.22 }}>
            <circle cx="20" cy="20" r="15" stroke="var(--muted)" strokeWidth="1" />
            <circle cx="20" cy="20" r="7" stroke="var(--muted)" strokeWidth="1" />
            <line x1="5" y1="20" x2="35" y2="20" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="20" y1="5" x2="20" y2="35" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          <div className="panel__empty-title">SELECT A COORDINATE</div>
          <div className="panel__empty-sub">TO VIEW STAR SYSTEMS</div>
        </div>
      </aside>
    );
  }

  const gridRef = `GRID SQUARE ${coord.col}-${String(coord.row).padStart(2, '0')}`;
  const countLabel = `${systems.length} ${systems.length === 1 ? 'SYSTEM' : 'SYSTEMS'}`;

  return (
    <aside className="panel">
      <div className="panel__header">
        <span className="panel__grid-ref">{gridRef}</span>
        <span className="panel__count">{countLabel}</span>
      </div>

      {systems.length === 0 ? (
        <div className="panel__empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.22 }}>
            <circle cx="20" cy="20" r="15" stroke="var(--muted)" strokeWidth="1" />
            <circle cx="20" cy="20" r="7" stroke="var(--muted)" strokeWidth="1" />
            <line x1="5" y1="20" x2="35" y2="20" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="20" y1="5" x2="20" y2="35" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          <div className="panel__empty-title">NO SYSTEMS CHARTED</div>
          <div className="panel__empty-sub">ADD ONE BELOW</div>
        </div>
      ) : (
        <div className="panel__list">
          {systems.map((system) => {
            const isActive = state.selectedSystem?.id === system.id;
            const meta = system.sector
              ? `${system.sector} \u00B7 ${system.region}`
              : system.region;

            return (
              <div
                key={system.id}
                className={`panel__row${isActive ? ' panel__row--active' : ''}`}
                onClick={() => navigate(`/systems/${system.id}`)}
              >
                <div className="panel__row-info">
                  <div className="panel__row-name">{system.name}</div>
                  <div className="panel__row-meta">{meta}</div>
                </div>
                <span
                  className={`panel__badge panel__badge--${system.isUserAdded ? 'added' : 'canon'}`}
                >
                  {system.isUserAdded ? 'ADDED' : 'CANON'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
