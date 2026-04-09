import type { GridColumn, GridRow } from '../types.ts';
import { useAppContext } from '../context/AppContext.tsx';

interface GridCellProps {
    col: GridColumn;
    row: GridRow;
    count: number;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

function densityClass(count: number): 0 | 1 | 3 | 4 {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 10) return 3;
    return 4;
}

export function GridCell({ col, row, count, isSelected, onClick, onMouseEnter, onMouseLeave }: GridCellProps) {
    const classes = [
        'cell',

    ]
}