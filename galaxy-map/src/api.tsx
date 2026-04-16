import type { GridColumn, GridRow, Region, System } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE;

interface RawSystem {
  id: number;
  name: string;
  sector: string | null;
  region: Region;
  grid_col: GridColumn;
  grid_row: GridRow;
  description: string | null;
  is_user_added: boolean | number;
}

function toSystem(raw: RawSystem): System {
  return {
    id: raw.id,
    name: raw.name,
    sector: raw.sector,
    region: raw.region,
    gridCoordinate: { col: raw.grid_col, row: raw.grid_row },
    description: raw.description,
    isUserAdded: Boolean(raw.is_user_added),
  };
}

export async function getAllSystems(): Promise<System[]> {
  const response = await fetch(`${API_BASE}/systems`);
  if (!response.ok) {
    throw new Error(`Failed to fetch systems: ${response.status}`);
  }
  const raw: RawSystem[] = await response.json();
  return raw.map(toSystem);
}


export async function getSystemsByCoordinate(
  col: GridColumn,
  row: GridRow,
): Promise<System[]> {
  const response = await fetch(`${API_BASE}/systems/grid/${col}/${row}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch systems for ${col}-${row}: ${response.status}`,
    );
  }
  const raw: RawSystem[] = await response.json();
  return raw.map(toSystem);
}

export async function getSystemById(id: string): Promise<System> {
  const response = await fetch(`${API_BASE}/systems/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch system with ID ${id}: ${response.status}`);
  }
  const raw: RawSystem = await response.json();
  return toSystem(raw);
}

export async function getNearbySystems(id: string): Promise<System[]> {
  const response = await fetch(`${API_BASE}/systems/${id}/nearby`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch nearby systems for ID ${id}: ${response.status}`,
    );
  }
  const raw: RawSystem[] = await response.json();
  return raw.map(toSystem);
}

// TODO: POST, PUT, DELETE functions for custom user-defined systems, if needed
