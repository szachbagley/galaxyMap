# Galaxy Map API

A REST API for the Star Wars Galaxy Map. Serves data for ~6,700 canon star systems organized on a 20×21 galactic grid (columns C–V, rows 1–21), and supports full CRUD for user-added systems.

**Base URL:** `http://localhost:3001`  
**All endpoints are prefixed with `/api`**

---

## Running the server

```bash
npm run dev   # development (nodemon)
npm start     # production
```

---

## Data Model

Every response object representing a system has the same shape:

```json
{
  "id": 1161,
  "name": "Coruscant",
  "sector": "Corusca (Coruscant)",
  "region": "Core Worlds",
  "grid_col": "L",
  "grid_row": 9,
  "description": null,
  "is_user_added": 0,
  "created_at": "2026-04-03T23:45:54.000Z",
  "updated_at": "2026-04-03T23:45:54.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Auto-incrementing primary key |
| `name` | string | System name |
| `sector` | string \| null | Galactic sector; null for many canon systems |
| `region` | string \| null | Galactic region (e.g. "Outer Rim Territories") |
| `grid_col` | string | Column letter, C through V |
| `grid_row` | integer | Row number, 1 through 21 |
| `description` | string \| null | Lore text; null for all seeded canon data |
| `is_user_added` | 0 \| 1 | 1 for user-created entries, 0 for canon |
| `created_at` | ISO 8601 timestamp | |
| `updated_at` | ISO 8601 timestamp | |

---

## Endpoints

### GET `/api/systems`

Returns all systems, sorted alphabetically by name. Accepts optional query parameters to filter to a single grid square.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `col` | string | Grid column letter (C–V), case-insensitive |
| `row` | integer | Grid row number (1–21) |

Both params are optional and independent. Providing both filters to a specific grid square.

**Response:** `200 OK` — array of system objects

```
GET /api/systems?col=J&row=8
```
```json
[
  { "id": 412, "name": "Bilbringi", "sector": null, "region": "Inner Rim", "grid_col": "J", "grid_row": 8, ... },
  { "id": 598, "name": "Devshi",    "sector": null, "region": "Inner Rim", "grid_col": "J", "grid_row": 8, ... },
  { "id": 827, "name": "Dorin", "sector": "Deadalis", "region": "Expansion Region", "grid_col": "J", "grid_row": 8, ... }
]
```

---

### GET `/api/systems/grid/:col/:row`

Returns all systems in a specific grid square, sorted alphabetically by name.

**URL parameters**

| Param | Type | Description |
|---|---|---|
| `col` | string | Grid column letter (C–V), case-insensitive |
| `row` | integer | Grid row number (1–21) |

**Response:** `200 OK` — array of system objects (may be empty)

```
GET /api/systems/grid/J/8
```
```json
[
  { "id": 412, "name": "Bilbringi", "sector": null, "region": "Inner Rim", "grid_col": "J", "grid_row": 8, ... },
  { "id": 598, "name": "Devshi",    "sector": null, "region": "Inner Rim", "grid_col": "J", "grid_row": 8, ... },
  { "id": 827, "name": "Dorin", "sector": "Deadalis", "region": "Expansion Region", "grid_col": "J", "grid_row": 8, ... }
]
```

---

### GET `/api/systems/:id`

Returns a single system by its ID.

**URL parameters**

| Param | Type | Description |
|---|---|---|
| `id` | integer | System ID |

**Response:** `200 OK` — single system object

```
GET /api/systems/1161
```
```json
{
  "id": 1161,
  "name": "Coruscant",
  "sector": "Corusca (Coruscant)",
  "region": "Core Worlds",
  "grid_col": "L",
  "grid_row": 9,
  "description": null,
  "is_user_added": 0,
  "created_at": "2026-04-03T23:45:54.000Z",
  "updated_at": "2026-04-03T23:45:54.000Z"
}
```

**Error responses**

| Status | Body | Condition |
|---|---|---|
| `404 Not Found` | `{ "error": "System not found" }` | No system with that ID |

---

### GET `/api/systems/:id/nearby`

Returns all systems in the 3×3 grid neighborhood surrounding the given system's coordinate (i.e., the system's own square plus the 8 adjacent squares). Results are sorted by column, then row, then name. Edge squares on the grid boundary return fewer results.

**URL parameters**

| Param | Type | Description |
|---|---|---|
| `id` | integer | System ID |

**Response:** `200 OK` — array of system objects

```
GET /api/systems/1161/nearby
```
```json
[
  { "id": 903, "name": "Anduvia", "grid_col": "K", "grid_row": 8, ... },
  { "id": 944, "name": "Aphran",  "grid_col": "K", "grid_row": 8, ... },
  ...
]
```

**Error responses**

| Status | Body | Condition |
|---|---|---|
| `404 Not Found` | `{ "error": "System not found" }` | No system with that ID |

---

### POST `/api/systems`

Creates a new user-defined system. The new system is marked `is_user_added: 1` and can be edited or deleted later.

**Request body** (`Content-Type: application/json`)

| Field | Required | Type | Constraints |
|---|---|---|---|
| `name` | yes | string | Non-empty |
| `grid_col` | yes | string | Letter C–V (case-insensitive) |
| `grid_row` | yes | integer | 1–21 |
| `sector` | no | string | Any value; stored as null if omitted |
| `region` | no | string | Any value; stored as null if omitted |
| `description` | no | string | Any value; stored as null if omitted |

```json
{
  "name": "Dagobah",
  "sector": "Sluis",
  "region": "Outer Rim Territories",
  "grid_col": "M",
  "grid_row": 19
}
```

**Response:** `201 Created` — the newly created system object

```json
{
  "id": 6759,
  "name": "Dagobah",
  "sector": "Sluis",
  "region": "Outer Rim Territories",
  "grid_col": "M",
  "grid_row": 19,
  "description": null,
  "is_user_added": 1,
  "created_at": "2026-04-04T04:36:55.000Z",
  "updated_at": "2026-04-04T04:36:55.000Z"
}
```

**Error responses**

| Status | Body | Condition |
|---|---|---|
| `400 Bad Request` | `{ "errors": ["name is required", ...] }` | Validation failed; `errors` lists all violations |

---

### PUT `/api/systems/:id`

Updates an existing user-defined system. Canon systems (seeded data) cannot be edited.

**URL parameters**

| Param | Type | Description |
|---|---|---|
| `id` | integer | System ID |

**Request body** (`Content-Type: application/json`) — same fields and constraints as POST. All fields should be provided; omitted optional fields are stored as null.

**Response:** `200 OK` — the updated system object

**Error responses**

| Status | Body | Condition |
|---|---|---|
| `400 Bad Request` | `{ "errors": [...] }` | Validation failed |
| `403 Forbidden` | `{ "error": "Cannot edit canon systems" }` | System is seeded canon data |
| `404 Not Found` | `{ "error": "System not found" }` | No system with that ID |

---

### DELETE `/api/systems/:id`

Deletes a user-defined system. Canon systems cannot be deleted.

**URL parameters**

| Param | Type | Description |
|---|---|---|
| `id` | integer | System ID |

**Response:** `204 No Content` — empty body

**Error responses**

| Status | Body | Condition |
|---|---|---|
| `403 Forbidden` | `{ "error": "Cannot delete canon systems" }` | System is seeded canon data |
| `404 Not Found` | `{ "error": "System not found" }` | No system with that ID |

---

## Validation Rules

Applied to `POST /api/systems` and `PUT /api/systems/:id`:

- `name` — required, must be a non-empty string
- `grid_col` — required, must be a single uppercase letter between C and V inclusive
- `grid_row` — required, must be an integer between 1 and 21 inclusive

A failed validation returns `400` with an `errors` array listing every violation:

```json
{
  "errors": [
    "name is required",
    "grid_col must be a letter between C and V",
    "grid_row must be an integer between 1 and 21"
  ]
}
```

---

## Error Response Shape

All error responses follow one of two shapes:

```json
{ "error": "Human-readable message" }
```
```json
{ "errors": ["validation message 1", "validation message 2"] }
```

Unhandled server errors return `500` with `{ "error": "Internal server error" }`.
