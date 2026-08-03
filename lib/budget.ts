import type { BudgetRow } from "./types";

/**
 * ============================================================================
 *  Project Budget Analysis — column model, formatting and aggregation helpers.
 * ============================================================================
 *  Source view: ProjectBudgetBalanceReport (see app/api/budget/route.ts).
 *  Everything the Summary / Details / Graphical tabs need to reshape the raw
 *  report rows lives here so the logic stays in one place.
 */

// Amount measures that are summed when categories are collapsed.
export const BUDGET_MEASURES = [
  "ORIGINALBUDGET",
  "COMMITTEDREVISIONS",
  "UNCOMMITTEDREVISIONS",
  "TotalBudget",
  "CONSUMEDBUDGET",
  "COMMITTMENT",
  "REMAININGBUDGET",
  "STOCKAMOUNT",
] as const;

// Capacity is constant per project (it repeats across category rows), so it is
// carried as the max — never summed.
export const CAPACITY_COL = "CAPACITYKWP";

// Per-Wp metrics are recomputed for the collapsed row as amount ÷ (kWp × 1000),
// i.e. INR per watt-peak, rather than summed across categories.
export const WP_DERIVED: { col: string; from: string }[] = [
  { col: "TOTALBUDGETWP", from: "TotalBudget" },
  { col: "CONSUMEDBUDGETWP", from: "CONSUMEDBUDGET" },
  { col: "REMAININGBUDGETWP", from: "REMAININGBUDGET" },
];

export const WP_COLS = WP_DERIVED.map((w) => w.col);

// Column groups used for formatting decisions in the UI.
export const CURRENCY_COLS = new Set<string>([...BUDGET_MEASURES]);
export const WP_COL_SET = new Set<string>(WP_COLS);

// Dimension (text) columns.
export const DIMENSION_COLS = new Set<string>([
  "SOLARPARKNAME",
  "PROJID",
  "PROJECTNAME",
  "PROJGROUPID",
  "CATEGORYID",
  "WAREHOUSE",
  "SITE",
  "PROJECTMANGER",
  "COMPANY",
]);

// Friendly headers.
export const BUDGET_LABELS: Record<string, string> = {
  SOLARPARKNAME: "Solar park",
  PROJID: "Project ID",
  PROJECTNAME: "Project name",
  PROJGROUPID: "Project group",
  CATEGORYID: "Category",
  ORIGINALBUDGET: "Original budget",
  COMMITTEDREVISIONS: "Committed revisions",
  TotalBudget: "Total budget",
  UNCOMMITTEDREVISIONS: "Uncommitted revisions",
  WAREHOUSE: "Warehouse",
  SITE: "Site",
  PROJECTMANGER: "Project manager",
  CONSUMEDBUDGET: "Consumed budget",
  COMMITTMENT: "Commitment",
  REMAININGBUDGET: "Remaining budget",
  TOTALBUDGETWP: "Total budget /Wp",
  CAPACITYKWP: "Capacity (kWp)",
  CONSUMEDBUDGETWP: "Consumed /Wp",
  REMAININGBUDGETWP: "Remaining /Wp",
  STOCKAMOUNT: "Stock amount",
  COMPANY: "Company",
};

// Column order for the Summary tab (Category removed).
export const SUMMARY_COLUMNS = [
  "PROJID",
  "PROJECTNAME",
  "SOLARPARKNAME",
  "PROJGROUPID",
  "SITE",
  "WAREHOUSE",
  "PROJECTMANGER",
  "COMPANY",
  "CAPACITYKWP",
  "ORIGINALBUDGET",
  "COMMITTEDREVISIONS",
  "UNCOMMITTEDREVISIONS",
  "TotalBudget",
  "CONSUMEDBUDGET",
  "COMMITTMENT",
  "REMAININGBUDGET",
  "STOCKAMOUNT",
  "TOTALBUDGETWP",
  "CONSUMEDBUDGETWP",
  "REMAININGBUDGETWP",
];

export function label(col: string): string {
  return BUDGET_LABELS[col] || col;
}

/** Coerce a possibly-string DB numeric into a JS number (NaN → 0). */
export function toNum(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/** INR currency, en-IN grouping, no decimals (budgets are large). */
export function fmtCurrency(v: any): string {
  const n = toNum(v);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** INR per-Wp, two decimals. */
export function fmtWp(v: any): string {
  const n = toNum(v);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Plain number, en-IN (e.g. capacity in kWp). */
export function fmtNum(v: any): string {
  const n = toNum(v);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Format any budget cell according to its column type. */
export function fmtCell(col: string, v: any): string {
  if (v === null || v === undefined || v === "") {
    return DIMENSION_COLS.has(col) ? "—" : fmtCurrency(0);
  }
  if (WP_COL_SET.has(col)) return fmtWp(v);
  if (CURRENCY_COLS.has(col)) return fmtCurrency(v);
  if (col === CAPACITY_COL) return fmtNum(v);
  return String(v);
}

/**
 * Collapse the CATEGORYID dimension: group rows by PROJID, sum the amount
 * measures, keep capacity as the project max, and recompute per-Wp metrics as
 * summed-amount ÷ (capacity-kWp × 1000).
 */
export function aggregateSummary(rows: BudgetRow[]): BudgetRow[] {
  const groups = new Map<string, BudgetRow>();

  for (const r of rows) {
    const key = String(r.PROJID ?? "").trim() || "(unknown)";
    let g = groups.get(key);
    if (!g) {
      g = {
        PROJID: r.PROJID,
        PROJECTNAME: r.PROJECTNAME,
        SOLARPARKNAME: r.SOLARPARKNAME,
        PROJGROUPID: r.PROJGROUPID,
        SITE: r.SITE,
        WAREHOUSE: r.WAREHOUSE,
        PROJECTMANGER: r.PROJECTMANGER,
        COMPANY: r.COMPANY,
        [CAPACITY_COL]: 0,
      };
      for (const m of BUDGET_MEASURES) g[m] = 0;
      groups.set(key, g);
    }
    for (const m of BUDGET_MEASURES) g[m] = toNum(g[m]) + toNum(r[m]);
    g[CAPACITY_COL] = Math.max(toNum(g[CAPACITY_COL]), toNum(r[CAPACITY_COL]));
    // Backfill any dimension that was null on the first row seen.
    for (const d of ["PROJECTNAME", "SOLARPARKNAME", "PROJGROUPID", "SITE", "WAREHOUSE", "PROJECTMANGER", "COMPANY"]) {
      if ((g[d] === null || g[d] === undefined || g[d] === "") && r[d]) g[d] = r[d];
    }
  }

  const out = Array.from(groups.values());
  for (const g of out) {
    const wp = toNum(g[CAPACITY_COL]) * 1000; // kWp → Wp
    for (const { col, from } of WP_DERIVED) {
      g[col] = wp > 0 ? toNum(g[from]) / wp : 0;
    }
  }
  out.sort((a, b) => toNum(b.TotalBudget) - toNum(a.TotalBudget));
  return out;
}

/** Sum the amount measures across a set of rows (for a Details totals row). */
export function sumMeasures(rows: BudgetRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of BUDGET_MEASURES) totals[m] = 0;
  for (const r of rows) for (const m of BUDGET_MEASURES) totals[m] += toNum(r[m]);
  return totals;
}

/** Total budget grouped by PROJGROUPID (for the group bar chart). */
export function groupByProjectGroup(
  rows: BudgetRow[]
): { name: string; total: number; consumed: number; remaining: number }[] {
  const map = new Map<string, { total: number; consumed: number; remaining: number }>();
  for (const r of rows) {
    const key = String(r.PROJGROUPID ?? "").trim() || "(none)";
    const g = map.get(key) || { total: 0, consumed: 0, remaining: 0 };
    g.total += toNum(r.TotalBudget);
    g.consumed += toNum(r.CONSUMEDBUDGET);
    g.remaining += toNum(r.REMAININGBUDGET);
    map.set(key, g);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
}

/** Compact INR label for chart axes/values (₹ Cr / ₹ L). */
export function fmtCompactINR(v: number): string {
  const n = Math.abs(v);
  if (n >= 1e7) return `₹${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  if (n >= 1e5) return `₹${(v / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
