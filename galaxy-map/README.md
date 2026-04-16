DEPLOYED REACT APP: https://galaxy-map-52-206-81-107.nip.io

# Galaxy Map

A diegetic, terminal-styled interface for exploring the Star Wars galaxy. Users browse a 20×21 grid representing galactic space, drill into any coordinate to see the star systems charted there, and inspect individual systems with their sector, region, description, and nearby neighbors.

Built for IS 542 at BYU. Frontend only — the backend lives in a sibling directory and is not part of this submission.

## Tech stack

- React 19 + TypeScript (strict)
- Vite 8
- React Router 7
- CSS (no UI framework — hand-authored monospace terminal aesthetic)

## Running the project

From the `galaxy-map/` directory:

```bash
npm install
npm run dev
```

The app expects a backend URL in the `VITE_API_BASE` environment variable. Create a `.env` file alongside `package.json`:

```
VITE_API_BASE=http://localhost:3000
```

Other scripts:

- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — run ESLint

## API and data handling

The frontend talks to a custom Node/Express + MySQL backend via four read endpoints:

| Endpoint                      | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `GET /systems`                | Full catalog of ~5,900 canon systems (loaded once on app mount) |
| `GET /systems/grid/:col/:row` | Systems at a specific coordinate                                |
| `GET /systems/:id`            | One system by ID (used as a deep-link fallback)                 |
| `GET /systems/:id/nearby`     | 3×3 neighborhood around a system (deep-link fallback)           |

All fetch calls live in `src/api.tsx`. The API returns snake_case fields (`grid_col`, `grid_row`, `is_user_added`), so every response is run through a `toSystem()` transform that normalizes it into the camelCase `System` shape used throughout the UI, collapsing `grid_col`/`grid_row` into a single `gridCoordinate` object.

Data flow is deliberately simple: the full system catalog is fetched once on mount and stored in a `useReducer` context (`src/context/AppContext.tsx`). Everything else is derived at render time — per-cell counts, the active coordinate's system list, and the detail page's nearby 3×3 — so there is no duplicated state to keep in sync. The detail page reads from context first and only falls back to the per-ID endpoints when the user deep-links before the bulk load finishes.

## Additional features

- **Client-side routing** — `/` shows the grid + system list, `/systems/:id` shows the detail page, direct-URL loads work via the API fallback.
- **Responsive mobile layout** — below 900px the grid and panel stack vertically and the grid resizes to viewport width. Dots switch to 50% opacity on touch devices (via `@media (hover: none)`) so the UI stays readable without hover.
- **Scan-sweep loading indicator** — animated sweep bar overlays the grid during the initial transmission and gates the detail page while archives load.
- **Error states** — failed fetches surface as in-grid "SIGNAL LOST" overlays; missing systems render "SYSTEM NOT FOUND IN ARCHIVES" with a back link.
- **Nearby grid widget** — 3×3 mini-grid on the detail page shows counts for adjacent coordinates, highlights the current cell in yellow, and handles galaxy-edge out-of-bounds cells gracefully.
- **Hover and selection feedback** — axis labels light up with the hovered row/column, selected cells get corner tick marks, and the system list highlights the active row.
- **Canon vs. user-added distinction** — every system carries a CANON or ADDED badge; the detail page exposes EDIT/DELETE controls for user-added systems (wired for a future CRUD milestone).
