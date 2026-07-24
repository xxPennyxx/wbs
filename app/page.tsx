"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface ProjectRow {
  id: string;
  name: string;
  raw: Record<string, any>;
}

// Curated "key" columns (actual Projectmaster column names), in display order.
const KEY_COLUMNS = [
  "PROJECTID",
  "PROJECTNAME",
  "PROJECTGROUP",
  "PROJECTTYPE",
  "PROJECTSTAGE",
  "STATUS",
  "WBSPERCENTAGE",
  "COMPANYCODE",
  "REGION",
  "SITENAME",
  "PLANT_CAPACITYAC",
  "PLANT_CAPACITYDC",
  "ACTUALSTARTDATE",
  "ACTUALENDDATE",
  "PROJECTCONTRACTID",
  "AMCORODINATOR",
  "CHANNELPARTNER",
];

// Friendly headers for known columns; anything else falls back to the raw name.
const LABELS: Record<string, string> = {
  PROJECTID: "Project ID",
  PROJECTNAME: "Project name",
  PROJECTGROUP: "Group",
  PROJECTTYPE: "Type",
  PROJECTSTAGE: "FPEL stage",
  STATUS: "Status",
  WBSPERCENTAGE: "WBS %",
  COMPANYCODE: "Legal entity",
  REGION: "Region",
  SITENAME: "Site name",
  PLANT_CAPACITYAC: "Capacity AC (kWp)",
  PLANT_CAPACITYDC: "Capacity DC (kWp)",
  ACTUALSTARTDATE: "Actual start",
  ACTUALENDDATE: "Actual end",
  PROJECTCONTRACTID: "Contract ID",
  AMCORODINATOR: "AM coordinator",
  CHANNELPARTNER: "Channel partner",
};

const STAGE_COLS = new Set(["PROJECTSTAGE", "STATUS", "WBSSTAGE"]);
const stageColor: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  "in progress": "bg-blue-100 text-blue-800",
  inprocess: "bg-blue-100 text-blue-800",
  terminated: "bg-rose-100 text-rose-800",
  hold: "bg-amber-100 text-amber-800",
  finished: "bg-emerald-100 text-emerald-800",
};

const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function label(col: string): string {
  return LABELS[col] || col;
}

function fmt(col: string, v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && ISO_DT.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-");
    if (y === "1900") return "—"; // D365 null-date sentinel
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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      })
      .then((data) => {
        setProjects(data.projects);
        setAllColumns(data.columns || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Column set for the current mode. "All" puts ID + name first, then the rest.
  const columns = useMemo(() => {
    if (!showAll) return KEY_COLUMNS.filter((c) => allColumns.length === 0 || allColumns.includes(c));
    const rest = allColumns.filter((c) => c !== "PROJECTID" && c !== "PROJECTNAME");
    return ["PROJECTID", "PROJECTNAME", ...rest];
  }, [showAll, allColumns]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      columns.some((c) => {
        const v = p.raw?.[c];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [projects, filter, columns]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-800">Projects</h1>
        <span className="text-sm text-slate-500">
          {filtered.length} of {projects.length} · {columns.length} columns
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            <button
              onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 text-sm ${!showAll ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Key columns
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 text-sm ${showAll ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              All columns
            </button>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-medium">Could not load projects.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading projects…</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "calc(100vh - 180px)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                    {label(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/project/${encodeURIComponent(p.id)}`)}
                  className="cursor-pointer hover:bg-teal-50/60"
                >
                  {columns.map((c) => {
                    const v = p.raw?.[c];
                    if (c === "PROJECTID") {
                      return (
                        <td key={c} className="whitespace-nowrap px-3 py-2 font-medium text-brand">
                          {p.id}
                        </td>
                      );
                    }
                    if (STAGE_COLS.has(c) && v != null && String(v).trim() !== "") {
                      const cls = stageColor[String(v).toLowerCase()] || "bg-slate-100 text-slate-700";
                      return (
                        <td key={c} className="whitespace-nowrap px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{String(v)}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {fmt(c, v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                    No projects match “{filter}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
