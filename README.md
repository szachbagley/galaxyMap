# Star Wars Galaxy Map

An interactive, searchable map of the Star Wars galaxy. Browse thousands of canon star systems organized by their in-universe grid coordinates, explore what systems share a region of space, and add your own custom planets to the map.

---

## Overview

The Star Wars galaxy is organized on a standard map grid, with columns labeled C through V and rows numbered 1 through 21. Every star system — from Coruscant to Tatooine to systems you've never heard of — occupies one of these grid squares, sometimes alongside dozens of neighbors.

This app makes that grid interactive. Click any square on the map to see which systems occupy it, then click a system to read its details and discover what else is nearby. A built-in form lets you add your own planets with a full set of coordinates.

---

## Features

- **Interactive galaxy grid** — a 20×21 map (columns C–V, rows 1–21) rendered as a clickable grid of squares
- **System list panel** — selecting a grid square reveals all canon systems located there
- **System detail page** — each system shows its name, sector, galactic region, and grid coordinate, plus a list of every system in the surrounding 3×3 neighborhood of squares
- **Add a system** — a form lets users define a custom star system with all the relevant fields and place it anywhere on the grid
- **~5,900 canon systems** seeded from the official *Star Wars: The Complete Visual Dictionary* star systems index

---

## Tech Stack

### Frontend
- React 18 with functional components and hooks
- TypeScript (strict mode)
- React Router for client-side navigation
- Vite as the build tool
- Fetch API for all data requests

### Backend
- Node.js with Express
- MySQL 8.4
- Knex.js for migrations, seeding, and query building

---

## Project Structure

```
star-wars-galaxy-map/
├── frontend/               # React/TypeScript app (IS 542 semester project)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── hooks/          # Custom hooks (e.g. useGrid, useSystems)
│   │   ├── types/          # TypeScript interfaces and types
│   │   └── main.tsx
│   └── package.json
│
└── backend/                # Node/Express REST API
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── utils/          # Input validation helpers
    │   └── db/
    │       ├── knexfile.js
    │       ├── migrations/
    │       └── seeds/
    ├── data/               # Parsed system data (used for seeding)
    ├── scripts/
    │   └── parsePdf.js     # One-time PDF-to-JSON extraction script
    ├── README.md           # Full API reference
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0
- npm

### 1. Clone the repository

```bash
git clone https://github.com/szachbagley/star-wars-galaxy-map.git
cd star-wars-galaxy-map
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=galaxy_map
PORT=3001
```

Create the database in MySQL:

```sql
CREATE DATABASE galaxy_map;
```

Run migrations and seed the database:

```bash
npx knex migrate:latest --knexfile src/db/knexfile.js
npx knex seed:run --knexfile src/db/knexfile.js
```

Start the API server:

```bash
npm run dev
```

The API will be running at `http://localhost:3001`.

See `backend/README.md` for the full API reference, including all endpoints, request/response formats, and validation rules.

### 3. Set up the frontend

```bash
cd ../frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

---

## API Reference

All endpoints are prefixed with `/api`. The backend serves 6,757 canon systems seeded from the source PDF.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/systems` | Return all systems. Accepts optional `?col=J&row=8` query params to filter by grid square. |
| `GET` | `/systems/grid/:col/:row` | Return all systems in a specific grid square. |
| `GET` | `/systems/:id` | Return a single system by ID. |
| `GET` | `/systems/:id/nearby` | Return all systems in the 3×3 grid neighborhood surrounding the given system. |
| `POST` | `/systems` | Create a new user-defined system. |
| `PUT` | `/systems/:id` | Update an existing user-defined system. |
| `DELETE` | `/systems/:id` | Delete a user-defined system. |

Canon systems (seeded from the official index) cannot be edited or deleted. See `backend/README.md` for full request/response documentation and validation rules.

---

## Deployment

The backend API is deployed on a single AWS EC2 t2.micro instance (Amazon Linux 2023) with MySQL running on the same server. See `backend/TEST-DEPLOYMENT.md` for infrastructure details, credentials, and redeployment instructions.

---

## Data Source

Canon star system data is sourced from the official star systems index published in the *Star Wars* reference materials. The dataset includes each system's name, sector (where listed), galactic region, and grid coordinate. 6,757 systems are included in the seed data.

The raw data was extracted from a PDF reference document using `pdftotext` and a custom Node.js parsing script (`backend/scripts/parsePdf.js`). The parser handles the PDF's two-column page layout, blank sector fields, and header/footer rows, producing a clean JSON array that is inserted into the database via Knex's seed mechanism.

---

## Data Model

### `systems` table

| Column | Type | Notes |
|---|---|---|
| `id` | integer | Auto-incrementing primary key |
| `name` | string | System name |
| `sector` | string | Galactic sector; null for many systems |
| `region` | string | Galactic region (e.g. "Outer Rim Territories") |
| `grid_col` | string | Column letter, C through V |
| `grid_row` | integer | Row number, 1 through 21 |
| `description` | text | Optional lore text; null for seeded canon data |
| `is_user_added` | boolean | True for user-created entries |

---

## State Management

The frontend manages four distinct pieces of state:

- **`systems`** — the full list of all systems, fetched from the API on load and used as the source of truth for all grid and detail views
- **`selectedCoordinate`** — the grid square the user has clicked, driving the system list panel
- **`selectedSystem`** — the system the user has navigated to, driving the detail page
- **`uiState`** — transient UI concerns: loading status, error messages, and form visibility

Nearby systems and per-square system lists are derived from these at render time rather than stored as separate state.

---

## Course Context

This project was built as the IS 542 (Enterprise Application Development) semester project at Brigham Young University. The assignment requires a fully functional single-page application built with TypeScript and React that interacts with at least one web API, demonstrates effective state management, implements client-side routing, and provides a polished user experience on both desktop and mobile.

---

## License

This project is for educational purposes. Star Wars canon data belongs to Lucasfilm Ltd. / Disney. The underlying system list is sourced from officially published reference materials.
