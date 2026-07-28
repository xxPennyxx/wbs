"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { WbsTask } from "@/lib/types";

// Curated "key" WBS columns (actual view column names), after WBS ID + Task name.
const KEY_COLUMNS = [
  "TASKCATEGORY",
  "TASKASSIGNEDHOURS",
  "TASKPLANNEDSTARTDATE",
  "TASKPLANNEDFINISHDATE",
  "TASKDURATION",
  "Actualstartdate",
  "Actualenddate",
  "Actualduration",
  "NUMBEROFRESOURCES",
  "Budgetedqty",
  "Completedqty",
  "WeightagePercentage",
  "taskprogresspercentage",
  "TASKPRIORITY",
  "Remarks",
];

const LABELS: Record<string, string> = {
  TASKCATEGORY: "Category",
  TASKASSIGNEDHOURS: "Effort (hrs)",
  TASKPLANNEDSTARTDATE: "Planned start",
  TASKPLANNEDFINISHDATE: "Planned finish",
  TASKDURATION: "Duration",
  Actualstartdate: "Actual start",
  Actualenddate: "Actual end",
  Actualduration: "Actual duration",
  NUMBEROFRESOURCES: "Resources",
  Budgetedqty: "Budgeted qty",
  Completedqty: "Completed qty",
  WeightagePercentage: "Weightage %",
  taskprogresspercentage: "Progress %",
  TASKPRIORITY: "Priority",
  Remarks: "Remarks",
  TASKSEQUENCE: "Seq",
  WBSTASKID: "WBS task ID",
  PATHID: "Path ID",
};

const NUMERIC_RIGHT = new Set([
  "TASKASSIGNEDHOURS",
  "TASKDURATION",
  "Actualduration",
  "NUMBEROFRESOURCES",
  "Budgetedqty",
  "Completedqty",
  "WeightagePercentage",
  "taskprogresspercentage",
]);

const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function label(c: string) {
  return LABELS[c] || c;
}

function fmt(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && ISO_DT.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-");
    if (y === "1900") return "—";
    return `${d}-${m}-${y}`;
  }
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? v.toLocaleString("en-IN")
      : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const s = String(v);
  if (/^(true|false)$/i.test(s)) return /true/i.test(s) ? "Yes" : "No";
  return s;
}

export default function WbsTable({
  tasks,
  columns,
  projectId = "WBS",
}: {
  tasks: WbsTask[];
  columns: string[];
  projectId?: string;
}) {
  const [showAll, setShowAll] = useState(true); // default: show all columns
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const dataCols = useMemo(() => {
    const keyPresent = KEY_COLUMNS.filter((c) => columns.length === 0 || columns.includes(c));
    if (!showAll) return keyPresent;
    if (columns.length === 0) return keyPresent;
    // All columns, ordered by importance: curated key columns first, then the rest.
    const rest = columns.filter((c) => !KEY_COLUMNS.includes(c));
    return [...keyPresent, ...rest];
  }, [showAll, columns]);

  // Which rows have children (so they get an expand/collapse toggle).
  const hasChildren = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) if (t.parentId) s.add(t.parentId);
    return s;
  }, [tasks]);

  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const t of tasks) m.set(t.id, t.parentId);
    return m;
  }, [tasks]);

  // A row is visible only if none of its ancestors are collapsed.
  const visibleTasks = useMemo(() => {
    if (collapsed.size === 0) return tasks;
    return tasks.filter((t) => {
      let p = t.parentId;
      while (p) {
        if (collapsed.has(p)) return false;
        p = parentOf.get(p) ?? null;
      }
      return true;
    });
  }, [tasks, collapsed, parentOf]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(hasChildren));
  const expandAll = () => setCollapsed(new Set());

  // Export the FULL tree (ignoring collapse state) to a real .xlsx file.
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const header = ["WBS ID", "Task name", ...dataCols.map(label)];
    const rows = tasks.map((t) => [
      t.wbsId || "",
      `${"    ".repeat(t.level)}${t.taskName}`, // indent to preserve hierarchy
      ...dataCols.map((c) => {
        const v = t.raw?.[c];
        if (v === null || v === undefined || v === "") return "";
        if (typeof v === "string" && ISO_DT.test(v)) {
          const [y, m, d] = v.slice(0, 10).split("-");
          return y === "1900" ? "" : `${d}-${m}-${y}`;
        }
        return typeof v === "number" ? v : String(v);
      }),
    ]);
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
    const title = [
      ["Fourth Partner Energy Private Limited"],
      [`Work breakdown structure — ${projectId}`],
      [`Exported ${stamp}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...title, header, ...rows]);
    // Merge the three heading lines across all columns.
    ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: header.length - 1 } }));
    ws["!cols"] = header.map((h, i) => ({ wch: i === 1 ? 42 : Math.max(12, String(h).length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WBS");
    const safe = projectId.replace(/[^A-Za-z0-9_-]+/g, "_");
    XLSX.writeFile(wb, `WBS_${safe}.xlsx`);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">WBS table</span>
        <span className="text-xs text-slate-400">{dataCols.length + 2} columns</span>

        <div className="ml-auto flex items-center gap-2">
          {hasChildren.size > 0 && (
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              <button onClick={expandAll} className="px-3 py-1 text-sm bg-white text-slate-600 hover:bg-slate-50">
                Expand all
              </button>
              <button onClick={collapseAll} className="border-l border-slate-300 px-3 py-1 text-sm bg-white text-slate-600 hover:bg-slate-50">
                Collapse all
              </button>
            </div>
          )}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            <button
              onClick={() => setShowAll(false)}
              className={`px-3 py-1 text-sm ${!showAll ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Key columns
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-3 py-1 text-sm ${showAll ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              All columns
            </button>
          </div>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={14} strokeWidth={2} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="card scrollbar-thin overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-medium">WBS ID</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Task name</th>
              {dataCols.map((c) => (
                <th
                  key={c}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${NUMERIC_RIGHT.has(c) ? "text-right" : ""}`}
                >
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleTasks.map((t) => {
              const expandable = hasChildren.has(t.id);
              const isCollapsed = collapsed.has(t.id);
              return (
                <tr key={t.id} className={t.isSummary ? "bg-slate-50/70 font-semibold" : ""}>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-500">{t.wbsId || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-800">
                    <span className="inline-flex items-center" style={{ paddingLeft: `${t.level * 16}px` }}>
                      {expandable ? (
                        <button
                          onClick={() => toggle(t.id)}
                          aria-label={isCollapsed ? "Expand" : "Collapse"}
                          className="mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
                        >
                          {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
                        </button>
                      ) : (
                        <span className="mr-1 inline-block h-4 w-4 shrink-0" />
                      )}
                      {t.taskName}
                    </span>
                  </td>
                  {dataCols.map((c) => (
                    <td
                      key={c}
                      className={`whitespace-nowrap px-3 py-1.5 text-slate-700 ${NUMERIC_RIGHT.has(c) ? "text-right tabular-nums" : ""}`}
                    >
                      {fmt(t.raw?.[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={dataCols.length + 2} className="px-3 py-10 text-center text-slate-400">
                  No WBS rows found for this project.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
