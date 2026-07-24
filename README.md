# FPEL · Project WBS & Gantt Viewer

A full-stack **Next.js 14 (App Router) + TypeScript + Tailwind** app that reads
project and work-breakdown-structure data from **SQL Server** and renders:

1. A searchable **Projects** list.
2. A per-project **work-breakdown structure** table (hierarchical, D365-style).
3. A **Gantt chart** (frappe-gantt) with Day / Week / Month zoom.

---

## 1. Prerequisites

- **Node.js 18.18+** (or 20+) and npm — install from https://nodejs.org
- Network access to the SQL Server (the DB is IP-firewalled, so run this from a
  machine/VPN that can reach `52.172.139.167:1433`).

## 2. Setup

```bash
cd wbs
npm install
```

Copy the env template and fill in real values (already done for you in
`.env.local`, which is git-ignored):

```bash
cp .env.example .env.local
```

`.env.local`:

```
DATABASE_URL=Server=52.172.139.167,1433;Database=ZapsightFAview;User Id=InqmindsSql;Password=YOUR_PASSWORD;Encrypt=false;TrustServerCertificate=true
```

> ⚠️ **Rotate the DB password** — it was shared in chat. Update it here and in the DB.

## 3. Run

```bash
npm run dev
```

Open http://localhost:3000

- `/` → projects list (click a row to open its WBS)
- `/project/<id>` → WBS table + Gantt
- `/api/schema` → **diagnostic**: shows the real column names of both tables

## 4. Aligning to your real schema (important)

The app doesn't hardcode column names — it maps *logical fields* to a list of
*candidate column names* and picks whichever exists. All of that lives in **one
file**: [`lib/schema.ts`](./lib/schema.ts).

If the projects list or WBS shows blanks/dashes:

1. Start the app and open **http://localhost:3000/api/schema** — it prints the
   actual columns of `Projectworkbreakdownstructure` and the projects table.
2. Open `lib/schema.ts` and add/adjust the candidate names:
   - `TABLES.projects` — set to your real projects table/view name (default guess: `Projects`).
   - `PROJECT_COLUMNS.*` — e.g. add `"ProjName"` to the `name` array.
   - `WBS_COLUMNS.*` — especially `projectId` (used to filter WBS by project),
     `wbsId`, `taskName`, `startDate`, `endDate`.
3. Save — the dev server hot-reloads.

### Hierarchy & Gantt notes

- **Parent/indent** is derived from the dotted `WBS ID` (e.g. `2.1` is a child of `2`).
  No separate parent column is needed.
- **Gantt bars** need a valid start *and* end date. Rows without both are listed
  in the WBS table but skipped in the Gantt (a count is shown).
- **Progress** reads `Total % of progress` if present (values 0–1 are treated as %).

## 5. Project structure

```
app/
  layout.tsx                     header + shell
  page.tsx                       projects list (client)
  project/[id]/page.tsx          WBS table + Gantt tabs (client)
  api/projects/route.ts          GET all projects
  api/projects/[id]/wbs/route.ts GET WBS rows for a project
  api/schema/route.ts            diagnostic column dump
components/
  GanttChart.tsx                 frappe-gantt wrapper
  WbsTable.tsx                   hierarchical WBS table
lib/
  db.ts                          mssql pool + connection-string parser
  schema.ts                      ← EDIT HERE to map columns
  introspect.ts                  INFORMATION_SCHEMA helpers
  wbs.ts                         raw rows → WBS tree
  types.ts                       shared types
```

## 6. Formatting conventions

Dates render as **DD-MM-YYYY** and numbers use the **en-IN** locale, per FPEL
conventions.

## 7. Security

- Credentials live only in `.env.local` (git-ignored). Never commit them.
- SQL is parameterised; table/column identifiers come from a fixed whitelist in
  `lib/schema.ts` (no user input reaches identifiers).
- `Encrypt=false` matches the provided connection string. For production,
  prefer `Encrypt=true` with a valid certificate.
```
