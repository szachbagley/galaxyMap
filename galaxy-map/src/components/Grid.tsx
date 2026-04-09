import { useAppContext } from '../context/AppContext.tsx';
import type { System, GridCoordinate } from '../types.tsx';

const { state, dispatch } = useAppContext();

let gridMap = new Map<GridCoordinate, { count: number; systems: System[] }>();

state.systems.forEach((system) => {
    const coord: GridCoordinate = system.gridCoordinate;
    if (!gridMap.has(coord)) {
        gridMap.set(coord, { count: 0, systems: [] });
    }
    const entry = gridMap.get(coord) ?? { count: 0, systems: [] };
    entry.count += 1;
    entry.systems.push(system);
});

