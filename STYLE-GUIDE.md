# Star Wars Galaxy Map — UI Aesthetic Style Guide

**Project:** Star Wars Galaxy Map (IS 542 / Enterprise Application Development, BYU)  
**Stack:** React 18 · TypeScript · Node/Express · MySQL  
**Version:** 1.0 — Internal Use

---

## 01 — Design Philosophy

This is a **diegetic interface** — it presents itself as a terminal that exists inside the Star Wars galaxy, not a website sitting on top of it. Every panel reads like a readout on a ship's navigation computer or a Rebel briefing console.

The UI is never decorative: borders encode state, color encodes data type, motion encodes signal reception. The galaxy grid is the primary object; all other panels are instruments that serve it.

Two principles govern every decision:

**Restraint enables density.** The app contains ~5,900 systems. Decoration competes with data. The aesthetic must make density legible, not overwhelming — restraint in ornamentation is what lets the data breathe.

**Canon and user data are visually distinct, not hierarchically ranked.** Seeded canon systems and user-added entries use different visual markers (cyan vs. yellow), but neither reads as "better." They simply look like they came from different sources, because they did.

---

## 02 — Color Palette

All colors are applied with semantic intent. Never use a color purely for aesthetics.

| Name | Hex | Usage |
|---|---|---|
| Void | `#090909` | Page background. Empty grid cells. |
| Surface | `#0E0E0E` | Panel backgrounds. Inactive cells. |
| Surface Raised | `#141414` | Hover backgrounds on list rows. |
| Rebel Yellow | `#FFE81A` | Selected state. Active frame. User-added system marker. Primary CTA. Form focus ring. |
| Hologram Cyan | `#00C8C8` | Data values. Canon system badge. Grid cell dots and borders (revealed on hover). Coordinate readouts. |
| Scanner Green | `#00CC44` | Grid hover crosshair. Cursor sweep. Loading scan animation. Nothing else. |
| Alert Red | `#CC2200` | Form validation errors. Delete actions. Required field markers. API error states. |
| Readout White | `#DDD8C4` | Primary body text. System names. |
| Console Gray | `#555550` | Field labels. Metadata. Null / empty values. |

### Color Semantics

**Yellow — Interaction.** Selected grid square · Active panel border · Submit / primary CTA · Form focus ring.

**Cyan — Data.** Coordinate values · Canon system badge · Grid cell dots and borders · Detail field values · Nearby system counts.

**Green — Scan / Cursor only.** Grid row/column hover crosshair · "Scanning…" loading state · Sweep animation. This color appears in exactly two contexts and nowhere else.

**Red — Threat / Destruction.** Form validation errors · Delete confirmation · Required field asterisk · API error states.

---

## 03 — Typography

Monospace is the only permitted typeface family — it communicates machine output, not a designed experience. Use `'Courier New', 'Courier', monospace` throughout.

All UI text is uppercase. Letter-spacing is generous. These two rules together transform coordinates and system names into data transmissions rather than labels.

| Role | Size | Letter-spacing | Color | Case |
|---|---|---|---|---|
| Page Title | 14px | 0.22em | Yellow | Uppercase |
| Panel Header | 9px | 0.15em | Yellow | Uppercase |
| System Name | 10–11px | 0.04em | Readout White | Uppercase |
| Coordinate Value | 11px | 0.06em | Cyan | Uppercase |
| Field Label | 8px | 0.15em | Console Gray | Uppercase |
| Metadata / Caption | 8px | 0.10em | Console Gray | Uppercase |
| Null / Empty Value | 10px | 0.04em | Console Gray | Italic |

### Null Field Handling

Many seeded systems have null `sector` values. Never leave a blank field — always render null values explicitly:

- Null sector → `— unknown —` (italic, Console Gray)
- Null description → `No data on record.` (italic, Console Gray)

This preserves the diegetic fiction that the database is a real record system with incomplete entries, rather than a web app with missing data.

Numbers always display with consistent digit counts: `04:22:09` not `4:22:9`, `08` not `8` for single-digit grid rows.

---

## 04 — Galaxy Grid (Primary View)

The 20×21 grid (columns C–V, rows 1–21) is the primary object of the application. All other panels serve it.

### Background Image

The grid renders over a drawing of the Star Wars galaxy map. The image covers the entire grid area (`background-size: cover`, `background-position: center`). A CSS gridline overlay sits on top of the image — 1px lines at `rgba(255,255,255,0.07)`, dim enough not to obscure the image but sufficient to show the grid structure. Individual cell borders and content are invisible until interaction.

### Cell States

| State | Border | Background | Dots |
|---|---|---|---|
| Default | None | Transparent | None |
| Hover | Cyan 1px | Transparent | Cyan dots (by density tier) |
| Selected | Yellow 2px + corner tick marks | Yellow 12% opacity | Yellow dots (by density tier) |

### Density Encoding

Density is encoded through dot count, not color. Four tiers:

| Systems in cell | Dots | Arrangement |
|---|---|---|
| 0 | 0 | — |
| 1–3 | 1 | Centered |
| 4–10 | 3 | Horizontal row |
| 11+ | 4 | 2×2 grid |

Dots are Hologram Cyan when the cell is hovered; Rebel Yellow when selected. No dot is visible in the default (unhovered) state — cells are fully transparent until interaction.

### Corner Tick Marks (Selected State)

The selected cell uses detached corner tick marks rather than a full border override. The 2px yellow border is supplemented with small L-shaped marks at each corner, offset 2px from the outer edge. This is the "bracket frame" pattern that appears throughout the reference UI imagery.

### Axis Labels

Column letters (C–V) and row numbers (1–21) sit outside the grid in a fixed header row and left column. They use 8px uppercase Console Gray text.

On hover of any cell, the corresponding column letter and row number highlight in Scanner Green — a crosshair effect that helps the user locate themselves on the map. Selected coordinate axis labels turn Yellow.

---

## 05 — System List Panel

The panel opens when a grid square is clicked — never on hover.

### Panel Header

- Left: grid reference label (e.g. `GRID SQUARE J-8`) in 9px Yellow uppercase
- Right: system count (e.g. `3 SYSTEMS`) in Cyan

### System Rows

Each row contains:
- System name — 10px Readout White uppercase
- Region / sector below — 8px Console Gray uppercase. Format: `SECTOR · REGION` when sector is present; region only when sector is null (no separator character)
- Source badge — right-aligned

**Active / selected row:** 2px Yellow left border + faint Yellow background tint (`rgba(255,232,26,0.06)`). No bold, no size change.

### Source Badges

| Badge | Color | Border | Background |
|---|---|---|---|
| `CANON` | Cyan | Cyan-dim | Cyan 6% opacity |
| `ADDED` | Yellow | Yellow-dim | Yellow 6% opacity |

The two badges carry equal visual weight — neither reads as more legitimate than the other.

### Empty State

When a grid square contains no systems: a dim radar SVG icon centered above the text `NO SYSTEMS CHARTED` (9px Console Gray uppercase) with a secondary line `ADD ONE BELOW` (8px Console Gray).

### Optional: Region Color Bands

A 4px left color band on system rows can encode galactic region at a glance, using the same Cyan opacity ramp as the grid cells:

| Region | Band Color |
|---|---|
| Core Worlds | Cyan 60% |
| Inner Rim | Cyan 40% |
| Expansion Region | Cyan 25% |
| Mid Rim | Cyan 15% |
| Outer Rim Territories | Cyan 6% |
| Unknown Regions | Yellow 30% |

---

## 06 — System Detail Page

### Header Block

- System name: 15px Readout White uppercase — the largest text element on the page
- Coordinate + region directly beneath: 9px Cyan uppercase, format `J-8 · EXPANSION REGION`

### Data Fields

Each field uses a label/value split with a 1px Console Gray divider between rows:

- Label: 8px Console Gray uppercase, left-aligned
- Value: 10px Cyan, right-aligned
- Null value: 9px Console Gray italic (`No data on record.` or `— unknown —`)

Fields displayed: Sector · Region · Grid Col · Grid Row · Description.

Grid row values display with leading zeros (`08` not `8`).

### Source Indicator

A source badge (`CANON` or `ADDED`) appears in the panel header, right-aligned. Canon records show no edit controls. User-added records show `EDIT` and `DELETE` action buttons in the header — these are the only records where destructive actions are surfaced.

### Nearby Systems — 3×3 Grid Neighborhood

The nearby widget is a miniature replica of the main grid using identical visual language:

- A 3×3 grid of cells representing the surrounding squares
- Each cell shows its grid coordinate (7px Console Gray) and system count (11px Cyan)
- The subject square (center cell) uses Yellow border + Yellow text instead of Cyan
- Empty cells show `—` in Console Gray instead of a count
- All cells are clickable and navigate to that grid square

This creates natural wayfinding through the galaxy using the same spatial vocabulary as the main map.

---

## 07 — Add / Edit System Form

### Inputs

All form inputs use:
- Background: `#141414` (Surface Raised)
- Border: 1px `#2E2E2A` at rest; 1px Yellow on focus
- Font: monospace, 10px, Readout White, generous letter-spacing
- No border-radius — sharp corners throughout
- Placeholder text: Console Gray italic

The focus ring is the only Yellow element on an input. No other highlight, glow, or shadow.

### Labels

8px Console Gray uppercase. Required fields have a Red asterisk after the label text (`*`) — this is the only required-field indicator. No asterisk legend needed; the color carries the meaning.

### Coordinate Fields

The grid coordinate is always split into two separate inputs: `COL (C–V)` and `ROW (1–21)`. Never combined into a single string input. This matches the data model (`grid_col` and `grid_row` as separate columns) and prevents formatting errors.

### Region Field

A `<select>` dropdown populated from the known region list. Never a free-text input — region is a controlled vocabulary.

### Validation Errors

Errors appear as a single error bar beneath the form — Red border, Red background tint, Red text in 9px monospace. Input borders flash Red for 300ms then hold. No inline tooltip errors, no shake animation, no per-field error labels. The error bar summarizes all issues at once.

### Buttons

| Button | Label | Color | Usage |
|---|---|---|---|
| Primary CTA | `PLACE SYSTEM` | Yellow border + Yellow bg tint | Form submit |
| Secondary | `CANCEL` | White border, no background | Dismiss form |
| Destructive | `DELETE SYSTEM` | Red border + Red bg tint | User-added records only |
| Disabled | `EDIT SYSTEM` | Gray border, 40% opacity | Canon records |

`PLACE SYSTEM` is the preferred CTA copy — diegetic and active. `SUBMIT` or `SAVE` are not permitted.

Canon systems never show Edit or Delete buttons. The disabled state on those controls makes the read-only nature of canon data self-evident.

---

## 08 — Frames, Borders & State Encoding

### Border Patterns

**Active Panel (Yellow):** 2px solid Yellow border + detached corner tick marks (L-shaped marks at each corner, 10px wide, offset 2px outward from the border). Used for: selected grid square, active form input.

**Data Panel (Cyan):** 1px solid Cyan-dim border + inset horizontal rules 4px from top and bottom edges at 40% Cyan opacity. Used for: detail readout panels, coordinate displays.

**Error / Alert (Red):** 1px solid Red-dim border + 3px offset outline at Red-dim. Used for: form error states, validation failures.

**Default Panel:** 1px solid `#222220`. Used for: all inactive panels, system list, form backgrounds.

### The No-Radius Rule

All corners are 90° sharp. No `border-radius` anywhere in the UI. The Star Wars aesthetic is rectilinear — the only curves in the application are in SVG icons (radar circles, targeting reticles) and are always intentional geometry, never cosmetic softening.

### Dividers

Panel internal dividers use 1px `#222220`. Never use heavier borders, double rules, or colored dividers inside panels.

---

## 09 — Motion & Interaction Behavior

### Grid Cell Click
Panel opens instantly (0ms delay). The selected cell's border transitions transparent → Yellow in 80ms. The panel itself appears without animation — no slide, no fade, no expand. Data is received, not revealed.

### Grid Cell Hover
The hovered cell's border and dots appear in Hologram Cyan. Column letter and row number in axis labels turn Scanner Green. This is the only use of Scanner Green on the interactive grid.

### Data Loading
Loading state: a slow horizontal scan line sweeps across the panel in Scanner Green (3s linear, repeating). Never a spinner, never a skeleton screen. Text reads `SCANNING…` in 8px Console Gray uppercase alongside the sweep. The sweep communicates signal acquisition — data is being received from a remote source.

### System Row Hover
Background shifts from transparent → `#141414` in 100ms. No scale change, no shadow, no underline. Border color on the row does not change — only background fills.

### Error State
Error bar appears beneath the form. Input border flashes Red for 300ms then holds. No shake animation — errors are silent and stationary in this universe.

### Page Transitions
Grid → detail navigation is an instant replace. No slide, no fade, no crossfade. The destination page's content appears as if received by signal — coordinates update in the header immediately. Continuity is provided by the persistent grid sidebar, not by transition effects.

### Alert Pulse (if needed)
If an alert state requires animation: pulse opacity between 60%–100% at ~1Hz. Opacity only — no movement, no color change, no scale.

---

## 10 — Design Constraints

### Permitted

- Near-black backgrounds only (`#090909` to `#1A1A1A`)
- Monospace font throughout — no exceptions
- Uppercase text everywhere in UI labels
- Sharp 90° corners — no `border-radius`
- 1px or sub-pixel borders
- Dot count pattern (0 / 1 / 3 / 4) for grid density encoding
- Galaxy map background image behind transparent grid cells
- Italic Console Gray for null field values
- Aurebesh script as static decorative labels (system identifiers, non-interactive)
- Asymmetric panel layouts
- Color used only to encode data meaning
- State transitions at ≤100ms

### Prohibited

- Rounded corners or `border-radius` on any element
- Drop shadows, glow effects, or `box-shadow` (except focus rings)
- Gradients anywhere except the grid density ramp
- Light or white backgrounds
- Proportional (sans-serif) fonts in the UI
- Smooth counter or number animations
- Skeleton screens or shimmer loading states
- Tooltip overlays — use panel context instead
- Mixed-case text in UI labels
- Icons from general icon libraries (e.g. Font Awesome, Heroicons) — use geometric SVG only
- Bright fills on panel backgrounds
- Edit or Delete controls on canon system records
- Colored or opaque cell backgrounds on the galaxy grid (cells must remain transparent)

---

## Appendix — Quick Reference: Key Color Values

```
--bg:          #090909   /* Void — page background */
--surface:     #0E0E0E   /* Panel background */
--surface2:    #141414   /* Hover state background */
--yellow:      #FFE81A   /* Rebel Yellow — interaction */
--yellow-dim:  #7A6F00   /* Yellow border on inactive states */
--yellow-bg:   rgba(255,232,26,0.06)
--cyan:        #00C8C8   /* Hologram Cyan — data, grid dots/borders */
--cyan-dim:    #005F5F   /* Cyan border on data panels */
--cyan-bg:     rgba(0,200,200,0.06)
--grid-line:   rgba(255,255,255,0.07) /* gridline overlay on galaxy image */
--green:       #00CC44   /* Scanner Green — cursor/scan only */
--red:         #CC2200   /* Alert Red — errors/delete */
--red-dim:     #5C0F00
--red-bg:      rgba(204,34,0,0.08)
--white:       #DDD8C4   /* Readout White — body text */
--muted:       #555550   /* Console Gray — labels/metadata */
--border:      #222220   /* Default panel border */
--border2:     #2E2E2A   /* Form input border */
--mono:        'Courier New', 'Courier', monospace
```
