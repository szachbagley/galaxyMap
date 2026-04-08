import type { GridColumn, GridRow, System } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE;

export async function getAllSystems(): Promise<System[]> {
  const response = await fetch(`${API_BASE}/systems`);
  if (!response.ok) {
    throw new Error(`Failed to fetch systems: ${response.status}`);
  }
  return response.json();
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
  return response.json();
}

export async function getSystemById(id: string): Promise<System> {
  const response = await fetch(`${API_BASE}/systems/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch system with ID ${id}: ${response.status}`);
  }
  return response.json();
}

export async function getNearbySystems(id: string): Promise<System[]> {
  const response = await fetch(`${API_BASE}/systems/${id}/nearby`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch nearby systems for ID ${id}: ${response.status}`,
    );
  }
  return response.json();
}

// TODO: POST, PUT, DELETE functions for custom user-defined systems, if needed
