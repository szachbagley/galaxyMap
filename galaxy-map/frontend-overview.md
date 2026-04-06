# Star Wars Galaxy Map — Frontend Overview

**Stack:** React 18 · TypeScript (strict) · React Router · Vite  
**Philosophy:** No third-party UI libraries. Keep dependencies minimal. The goal is to practice React and TypeScript, so prefer building over importing.

---

## The Shape of the App

The frontend has four distinct views that share a persistent layout shell:

- The **galaxy grid** — the primary view, a 20×21 clickable map
- The **system list panel** — opens alongside the grid when a cell is selected
- The **system detail page** — a full-page view for a single system
- The **add/edit form** — a panel or page for creating and editing user systems

The grid and list panel coexist on the same page (split layout). The detail page is a separate route. The form can live as an overlay or a dedicated route — either works.

---

## Milestones

### 1. Project Scaffold

Get Vite + React + TypeScript running with React Router configured. Establish the folder structure (`components/`, `pages/`, `hooks/`, `types/`). Define the core TypeScript interfaces that reflect the data model — `System`, `GridCoordinate`, and the API response shapes. Getting the types right early prevents pain later.

### 2. API Layer

Write a small set of plain fetch functions (not a library) that cover every backend endpoint: fetching all systems, fetching by grid square, fetching a single system by ID, fetching nearby systems, and the create/update/delete mutations. These functions return typed promises. This is the only place in the app that knows the API exists — everything else calls these functions.

### 3. State Architecture

Decide how state flows before writing any components. The README describes four state slices: the full systems list, the selected grid coordinate, the selected system, and transient UI state (loading, errors, form visibility). Whether this lives in a top-level component with prop drilling, or in a shared context, nail it down here. For a project this size, a single context or a well-structured top-level component are both reasonable — pick one and be consistent.

### 4. Galaxy Grid

This is the centerpiece and the most interesting component to build. A 20×21 grid of cells, each of which knows how many systems it contains and what state it's in (empty, sparse, dense, core, selected, user-added). The density calculation — mapping system count to a visual tier — is derived at render time from the systems list, not stored as separate state. Column and row axis labels live outside the grid. Clicking a cell updates `selectedCoordinate`. This milestone is complete when the full grid renders correctly with real data and selection works.

### 5. System List Panel

A panel that reacts to `selectedCoordinate`. When a coordinate is selected, it filters the systems list and displays the results. Each row shows the system name, region/sector, and a canon vs. user-added badge. Clicking a row navigates to the detail page. The empty state (no systems in this square) needs handling. This component is largely presentational once the data flow is in place.

### 6. System Detail Page

A route-level page (`/systems/:id`) that fetches a single system and its nearby systems. The detail card displays all fields with graceful null handling. The nearby 3×3 grid widget is a small version of the main grid — it can share visual logic with the main grid but is a separate, simpler component. User-added systems show edit and delete controls here; canon systems do not.

### 7. Add / Edit Form

A form for creating a new system or editing a user-added one. Fields map directly to the data model: name, sector, region (a select from a fixed list), grid column, grid row, and description. Coordinate fields are split — col and row as separate inputs. Client-side validation runs before any API call. On success, the systems list updates and the user is returned to the relevant view. This milestone covers both the add and edit flows since they share nearly all the same logic.

### 8. Delete Flow

Wiring up the delete action on user-added system detail pages. Includes a confirmation step (a simple inline confirm state, not a modal library) before the API call is made. On success, navigate back to the grid and remove the system from local state.

### 9. Loading & Error States

Go back through every data-fetching path and make sure loading and error states are handled visibly. Loading renders the scan-sweep indicator described in the style guide. Errors surface a clear message rather than a blank panel. This is a polish pass, but an important one — the app should never silently fail or appear frozen.

### 10. Mobile Layout

The split grid + panel layout needs a responsive treatment for smaller screens. On mobile, the grid and panel stack vertically rather than sitting side by side. The detail page is already single-column and will likely need minimal adjustment. This is the final pass before the project is considered complete.

---

## A Few Things Worth Keeping in Mind

**Derive, don't store.** The per-cell system counts, the nearby systems list, and the filtered systems for the list panel are all computable from the main `systems` array. Storing them separately as state creates sync bugs. Calculate them at render time.

**Types are documentation.** Strict TypeScript pays dividends throughout — a well-typed `System` interface makes every component's props self-documenting and catches API shape mismatches early.

**The grid is a pure rendering problem.** Given a coordinate and a count, a cell knows exactly how to render itself. Keep the cell component focused and stateless; let the parent manage which coordinate is selected.

**The form and the detail page share a data concern.** After a successful create or edit, the app needs to reflect the change immediately. Think about how the systems list gets refreshed — a refetch, a local splice, or a combination — before writing the form submission logic.
