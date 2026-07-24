"use client";

import { useMemo, useState } from "react";
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
}: {
  tasks: WbsTask[];
  columns: string[];
}) {
  const [showAll, setShowAll] = useState(false);

  const dataCols = useMemo(() => {
    if (showAll) return columns;
    return KEY_COLUMNS.filter((c) => columns.length === 0 || columns.includes(c));
  }, [showAll, columns]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">WBS table</span>
        <span className="text-xs text-slate-400">{dataCols.length + 2} columns</span>
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-300">
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
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "calc(100vh - 220px)" }}>
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
            {tasks.map((t) => (
              <tr key={t.id} className={t.isSummary ? "bg-slate-50/70 font-semibold" : ""}>
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-500">{t.wbsId || "—"}</td>
                <td className="px-3 py-1.5 text-slate-800">
                  <span style={{ paddingLeft: `${t.level * 16}px` }} className="inline-block">
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
            ))}
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
