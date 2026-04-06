export type GridColumn =
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V";

export type GridRow =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21;

export type Region =
  | "Deep Core"
  | "Core"
  | "Colonies"
  | "Inner Rim"
  | "Expansion Region"
  | "Mid Rim"
  | "Outer Rim"
  | "Hutt Space"
  | "Wild Space"
  | "Unknown Regions";

export type GridCoordinate = {
  x: GridColumn;
  y: GridRow;
};

export interface System {
  id: number;
  name: string;
  sector: string;
  region: Region;
  gridCoordinate: GridCoordinate;
  description: string;
  isUserAdded: boolean;
}
