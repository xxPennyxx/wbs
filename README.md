# FPEL · Project WBS & Gantt Viewer

A full-stack **Next.js 14 (App Router) + TypeScript + Tailwind** application that
reads project and work-breakdown-structure (WBS) data from **SQL Server** and
turns it into an interactive project-tracking view for Fourth Partner Energy
(FPEL).

## What this app does

The tool gives project, delivery and asset teams a single place to see where an
EPC project stands against plan:

1. **Projects list (`/`)** — a filterable, sortable register of projects sourced
   from `Projectmaster`. It supports search by name/ID, per-column filters, a
   **Project group** multiselect, column sorting, and pagination for large data
   sets.
2. **WBS table (`/project/<id>`)** — the hierarchical work-breakdown structure
   for one project, indented by its nested task sequence (`1`, `2`, `2.1`,
   `2.2`, `3`, …), sourced from `Projectworkbreakdownstructure`.
3. **Gantt chart (`/project/<id>`)** — a custom SVG timeline with **Day / Week /
   Month** zoom that plots each task as **two layered bars — planned vs actual —**
   with a progress fill and a "today" marker. The year is always shown in the
   header at every zoom level.

The app has two top-level menus in the header:

- **Work Breakdown Structure** — the projects register, WBS table and Gantt chart
  described above.
- **Project Budget Analysis** — a budget-balance dashboard sourced from
  `ProjectBudgetBalanceReport` (see the dedicated section below).

All dates render as **DD-MM-YYYY** and numbers use the **en-IN** locale, per FPEL
conventions.

---

## Project Budget Analysis (`/budget`)

A budget-balance dashboard for the whole portfolio, sourced from the
`ProjectBudgetBalanceReport` view. It runs for **all companies** — there is **no
company filter** (the `COMPANY` field is returned as a regular, filterable
column). The page has three tabs:

1. **Summary** — one row per project, with the **Category** dimension collapsed.
   Amount columns are **summed** across categories; capacity is held constant per
   project (max); and the per-Wp metrics are **recomputed** as
   `amount ÷ (CAPACITYKWP × 1000)` (INR per watt-peak).
2. **Details** — the report query executed as-is (one row per project × category),
   with a **TOTAL** row that sums the amount columns.
3. **Graphical views** — KPI cards plus charts: portfolio budget utilisation
   (consumed vs commitment vs remaining), total budget by project group, and the
   top projects by total budget (consumed vs total).

All amounts are in **INR** (en-IN locale). Both table tabs support **per-column
sort and per-column filter** (a filter box under each header) and **Excel
export** of the filtered/sorted view.

### Budget query — `ProjectBudgetBalanceReport`

The menu is driven by the query below. It is run once for **all companies** (the
`company` filter is dropped so every company is returned, and `COMPANY` is added
to the projection as a normal, filterable column). The literal per-company form
is shown in the comment.

```sql
Select SOLARPARKNAME, PROJID, PROJECTNAME, PROJGROUPID, CATEGORYID,
       ORIGINALBUDGET, COMMITTEDREVISIONS, BUDGET [TotalBudget],
       UNCOMMITTEDREVISIONS, WAREHOUSE, SITE, PROJECTMANGER,
       CONSUMEDBUDGET, COMMITTMENT, REMAININGBUDGET, TOTALBUDGETWP,
       CAPACITYKWP, CONSUMEDBUDGETWP, REMAININGBUDGETWP, STOCKAMOUNT
from ProjectBudgetBalanceReport
where company = '1000';   -- per-company form; the app runs this for ALL companies
```

> **Scope:** the app executes the query **without** the `where company = '1000'`
> clause so the report covers every company, and adds `COMPANY` to the `SELECT`
> as a normal column that can be sorted/filtered like any other. The
> implementation lives in [`app/api/budget/route.ts`](./app/api/budget/route.ts);
> reshaping/aggregation lives in [`lib/budget.ts`](./lib/budget.ts).

---

## Data model & SQL queries

The app is driven by two SQL Server objects: `Projectmaster` (one row per
project) and `Projectworkbreakdownstructure` (one row per WBS task). The queries
below define exactly what the app reads.

### Projects list — `Projectmaster`

The projects register is scoped to the **EPC project groups only** (see the
Master list below). Only EPC groups are relevant for Gantt / WBS delivery
tracking, so other groups are excluded.

```sql
Select projectID, PROJECTNAME, PROJECTGROUP, PROJECTSTAGE, PLANT_CAPACITYAC, PLANT_CAPACITYDC, SOLARPARKNAME,
       WAREHOUSE, WBSPERCENTAGE, ACTUALSTARTDATE, ACTUALENDDATE, CUSTOMERACCOUNT, APPROVALAUTHORITY, STATUS, ENDCUSTOMERDESC,
       PROJECTCONTOLLERPERSONNELNUMBER, PROJECTMANAGERPERSONNELNUMBER, SALESMANAGERPERSONNELNUMBER, PROEJCTENDDATE, PROEJCTENDTIME
from Projectmaster
where Projectgroup in (/* from the Master list below */);
```

**Master — allowed EPC project groups**

| ProjectGroup |
| ------------ |
| EPC-OA Win   |
| EPC-CAPEX    |
| EPC-OA Dev   |
| EPC-OPENAC   |
| EPC-OA Hyb   |
| EPC-OA Sol   |
| EPC-OPEX     |
| EPC-OA-Cap   |

> **Gantt scope:** the Gantt chart (and WBS tracking) is intended for **EPC
> project groups only**. The Projects page exposes these eight groups through
> the **Project group** multiselect so the register can be narrowed to the EPC
> portfolio before drilling into a project's WBS/Gantt.

### WBS + Gantt — `Projectworkbreakdownstructure`

Run per project, keyed by `PROJID`. `PathID` carries the nested task sequence
(`1`, `2`, `2.1`, …) that drives both the table indentation and the Gantt row
order.

```sql
Select PathID, TASKNAME, TASKPLANNEDSTARTDATE, TASKPLANNEDFINISHDATE,
       Actualstartdate, Actualenddate, Budgetedqty, Completedqty, WeightagePercentage, taskprogresspercentage,
       *
from Projectworkbreakdownstructure
where PROJID = 'PRJ-22-0043';
```

- **Planned bar** uses `TASKPLANNEDSTARTDATE` → `TASKPLANNEDFINISHDATE`.
- **Actual bar** uses `Actualstartdate` → `Actualenddate`.
- **Progress fill** uses `taskprogresspercentage` (values 0–1 are treated as %).

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

- `/` → **Work Breakdown Structure** — projects list (click a row to open its WBS)
- `/project/<id>` → WBS table + Gantt
- `/budget` → **Project Budget Analysis** — Summary / Details / Graphical views
- `/api/schema` → **diagnostic**: shows the real column names of both tables

## 4. Aligning to your real schema (important)

The app doesn't hardcode column names — it maps *logical fields* to a list of
*candidate column names* and picks whichever exists. All of that lives in **one
file**: [`lib/schema.ts`](./lib/schema.ts).

If the projects list or WBS shows blanks/dashes:

1. Start the app and open **http://localhost:3000/api/schema** — it prints the
   actual columns of `Projectworkbreakdownstructure` and `Projectmaster`.
2. Open `lib/schema.ts` and add/adjust the candidate names:
   - `TABLES.projects` — the projects table/view (`Projectmaster`).
   - `PROJECT_COLUMNS.*` — e.g. add another spelling to the `name` array.
   - `WBS_COLUMNS.*` — especially `projectId` (used to filter WBS by project),
     `wbsId`, `taskName`, `startDate`, `endDate`.
3. Save — the dev server hot-reloads.

### Hierarchy & Gantt notes

- **Parent/indent** is derived from the nested `PathID` sequence (e.g. `2.1` is a
  child of `2`). No separate parent column is needed.
- **Gantt bars** need a valid start *and* end date. A task with planned dates
  gets a planned bar; with actual dates it gets an actual bar. Rows with neither
  are listed in the WBS table but skipped in the Gantt (a count is shown).
- **Progress** reads `taskprogresspercentage` (values 0–1 are treated as %).

## 5. Project structure

```
app/
  layout.tsx                     header + top nav menu (WBS · Project Budget Analysis) + shell
  page.tsx                       projects list — search / filter / sort / group multiselect / pagination
  project/[id]/page.tsx          WBS table + Gantt tabs (client)
  budget/page.tsx                Project Budget Analysis — Summary / Details / Graphical views (client)
  api/projects/route.ts          GET all projects (Projectmaster)
  api/projects/[id]/wbs/route.ts GET WBS rows for a project
  api/budget/route.ts            GET ProjectBudgetBalanceReport rows (all companies)
  api/schema/route.ts            diagnostic column dump
components/
  NavMenu.tsx                    top navigation menu (active-state highlighting)
  GanttChart.tsx                 custom SVG Gantt — planned vs actual layered bars, Day/Week/Month
  WbsTable.tsx                   hierarchical WBS table
  BudgetCharts.tsx               SVG budget charts (donut, group bars, top-projects bars)
lib/
  db.ts                          mssql pool + connection-string parser
  schema.ts                      ← EDIT HERE to map columns
  budget.ts                      budget column model, formatting & category-collapse aggregation
  introspect.ts                  INFORMATION_SCHEMA helpers
  wbs.ts                         raw rows → WBS tree (PathID hierarchy, planned/actual dates)
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
- Treat all project, customer and personnel data returned by these queries as
  **confidential** per FPEL data-handling policy.
```
