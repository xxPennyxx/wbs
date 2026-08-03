"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Download } from "lucide-react";
import type { BudgetRow } from "@/lib/types";
import BudgetCharts from "@/components/BudgetCharts";
import {
  SUMMARY_COLUMNS,
  DIMENSION_COLS,
  BUDGET_MEASURES,
  label,
  fmtCell,
  toNum,
  aggregateSummary,
  sumMeasures,
} from "@/lib/budget";

type Tab = "summary" | "details" | "charts";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "details", label: "Details" },
  { id: "charts", label: "Graphical views" },
];

export default function BudgetPage() {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [detailColumns, setDetailColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("summary");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    fetch("/api/budget")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      })
      .then((data) => {
        setRows(data.rows || []);
        setDetailColumns(data.columns || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Summary = collapse the Category dimension (across all companies).
  const summaryRows = useMemo(() => aggregateSummary(rows), [rows]);

  // Columns / base rows for the active table tab.
  const activeCols = tab === "summary" ? SUMMARY_COLUMNS : detailColumns;
  const baseRows = tab === "summary" ? summaryRows : rows;

  // Active per-column filters.
  const activeColFilters = useMemo(
    () => Object.entries(colFilters).filter(([, v]) => v.trim() !== ""),
    [colFilters]
  );

  // Apply per-column filters (case-insensitive substring on the shown value).
  const filtered = useMemo(() => {
    if (activeColFilters.length === 0) return baseRows;
    return baseRows.filter((r) =>
      activeColFilters.every(([col, raw]) => {
        const needle = raw.trim().toLowerCase();
        const hay = `${fmtCell(col, r[col])} ${r[col] ?? ""}`.toLowerCase();
        return hay.includes(needle);
      })
    );
  }, [baseRows, activeColFilters]);

  // Sorting (numeric- and text-aware).
  const sortedRows = useMemo(() => {
    if (!sort) return filtered;
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    const isNumeric = !DIMENSION_COLS.has(col);
    return [...filtered].sort((a, b) => {
      if (isNumeric) return (toNum(a[col]) - toNum(b[col])) * mul;
      const as = String(a[col] ?? "").toLowerCase();
      const bs = String(b[col] ?? "").toLowerCase();
      return (as < bs ? -1 : as > bs ? 1 : 0) * mul;
    });
  }, [filtered, sort]);

  // Footer totals reflect the filtered rows on screen.
  const footerTotals = useMemo(() => sumMeasures(filtered), [filtered]);

  const toggleSort = (col: string) =>
    setSort((prev) =>
      prev?.col === col ? (prev.dir === "asc" ? { col, dir: "desc" } : null) : { col, dir: "asc" }
    );

  const setColFilter = (col: string, val: string) =>
    setColFilters((prev) => ({ ...prev, [col]: val }));

  const clearAll = () => {
    setColFilters({});
    setSort(null);
  };

  const hasActive = activeColFilters.length > 0 || sort !== null;

  // Excel export of the currently active (filtered + sorted) table.
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const cols = activeCols;
    const aoa: any[][] = [cols.map((c) => label(c))];
    for (const r of sortedRows) aoa.push(cols.map((c) => (DIMENSION_COLS.has(c) ? r[c] ?? "" : toNum(r[c]))));
    aoa.push(cols.map((c) => (BUDGET_MEASURES.includes(c as any) ? footerTotals[c] : c === cols[0] ? "TOTAL" : "")));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === "summary" ? "Summary" : "Details");
    XLSX.writeFile(wb, `project-budget-${tab}.xlsx`);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Project Budget Analysis</h1>
          <p className="mt-1 text-sm text-slate-500">
            All companies · {summaryRows.length} projects · {rows.length} category rows
            {tab !== "charts" && activeColFilters.length > 0 ? ` · ${sortedRows.length} shown` : ""}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tab !== "charts" && hasActive && (
            <button
              onClick={clearAll}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
          {tab !== "charts" && (
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              title="Export current table to Excel"
            >
              <Download size={14} strokeWidth={2} />
              Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-slate-300 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setSort(null);
              setColFilters({});
            }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-medium">Could not load the project budget report.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading project budget report…</div>
      ) : tab === "charts" ? (
        <BudgetCharts summary={summaryRows} />
      ) : (
        <>
          <div className="card scrollbar-thin overflow-auto" style={{ maxHeight: "560px" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                {/* Sort row */}
                <tr>
                  {activeCols.map((c) => {
                    const active = sort?.col === c;
                    const numeric = !DIMENSION_COLS.has(c);
                    return (
                      <th
                        key={c}
                        className={`whitespace-nowrap px-3 py-2 font-medium ${numeric ? "text-right" : ""}`}
                      >
                        <button
                          onClick={() => toggleSort(c)}
                          className={`inline-flex items-center gap-1 hover:text-brand ${active ? "text-brand" : ""}`}
                          title="Sort"
                        >
                          {label(c)}
                          {active ? (
                            sort!.dir === "asc" ? (
                              <ChevronUp size={13} strokeWidth={2} />
                            ) : (
                              <ChevronDown size={13} strokeWidth={2} />
                            )
                          ) : (
                            <ChevronsUpDown size={13} strokeWidth={2} className="text-slate-400" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
                {/* Per-column filter row */}
                <tr>
                  {activeCols.map((c) => (
                    <th key={c} className="px-2 pb-2 pt-0 font-normal">
                      <input
                        value={colFilters[c] ?? ""}
                        onChange={(e) => setColFilter(c, e.target.value)}
                        placeholder="Filter"
                        className="w-full min-w-[80px] rounded border border-slate-200 px-2 py-1 text-xs normal-case tracking-normal text-slate-700 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((r, i) => (
                  <tr key={String(r.PROJID) + "-" + (r.CATEGORYID ?? "") + "-" + i} className="hover:bg-teal-50/60">
                    {activeCols.map((c) => {
                      const numeric = !DIMENSION_COLS.has(c);
                      const emphasize = c === "TotalBudget";
                      return (
                        <td
                          key={c}
                          className={`whitespace-nowrap px-3 py-2 ${
                            numeric ? "text-right tabular-nums" : ""
                          } ${emphasize ? "font-semibold text-slate-900" : "text-slate-700"} ${
                            c === "PROJID" ? "font-medium text-brand" : ""
                          }`}
                        >
                          {fmtCell(c, r[c])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={activeCols.length} className="px-3 py-10 text-center text-slate-400">
                      No rows match the current column filters.
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedRows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-100 text-xs font-semibold text-slate-800">
                  <tr>
                    {activeCols.map((c, idx) => {
                      const numeric = !DIMENSION_COLS.has(c);
                      if (idx === 0) {
                        return (
                          <td key={c} className="whitespace-nowrap px-3 py-2">
                            TOTAL{tab === "summary" ? ` · ${sortedRows.length} projects` : ` · ${sortedRows.length} rows`}
                          </td>
                        );
                      }
                      // Sum amount measures; leave capacity / per-Wp / dimension cells blank.
                      if (BUDGET_MEASURES.includes(c as any)) {
                        return (
                          <td key={c} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {fmtCell(c, footerTotals[c])}
                          </td>
                        );
                      }
                      return <td key={c} className={`px-3 py-2 ${numeric ? "text-right" : ""}`} />;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {tab === "summary"
              ? "Grouped by project (Category collapsed): amount columns are summed; capacity is held constant per project and per-Wp metrics are recomputed as amount ÷ (kWp × 1000). Click a header to sort; use the boxes to filter each column."
              : "One row per project × category, exactly as returned by the report query. Click a header to sort; use the boxes to filter each column. The TOTAL row sums the amount columns."}
          </p>
        </>
      )}
    </div>
  );
}
