"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  raw: Record<string, any>;
}

// Fixed column set for the projects list (actual Projectmaster column names),
// in display order. Column-name spellings match the DB view exactly.
const DISPLAY_COLUMNS = [
  "PROJECTID",
  "PROJECTNAME",
  "WBSPERCENTAGE",
  "PROJECTGROUP",
  "PROJECTSTAGE",
  "PLANT_CAPACITYAC",
  "PLANT_CAPACITYDC",
  "SOLARPARKNAME",
  "WAREHOUSE",
  "ACTUALSTARTDATE",
  "ACTUALENDDATE",
  "CUSTOMERACCOUNT",
  "APPROVALAUTHORITY",
  "STATUS",
  "ENDCUSTOMERDESC",
  "PROJECTCONTOLLERPERSONNELNUMBER",
  "PROJECTMANAGERPERSONNELNUMBER",
  "SALESMANAGERPERSONNELNUMBER",
  "PROEJCTENDDATE",
  "PROEJCTENDTIME",
];

// Project-group options for the multiselect filter (Projectmaster.PROJECTGROUP).
const PROJECT_GROUPS = [
  "EPC-OA Win",
  "EPC-CAPEX",
  "EPC-OA Dev",
  "EPC-OPENAC",
  "EPC-OA Hyb",
  "EPC-OA Sol",
  "EPC-OPEX",
  "EPC-OA-Cap",
];

const PAGE_SIZE = 100;

// Friendly headers for known columns; anything else falls back to the raw name.
const LABELS: Record<string, string> = {
  PROJECTID: "Project ID",
  PROJECTNAME: "Project name",
  PROJECTGROUP: "Group",
  PROJECTSTAGE: "FPEL stage",
  PLANT_CAPACITYAC: "Capacity AC (kWp)",
  PLANT_CAPACITYDC: "Capacity DC (kWp)",
  SOLARPARKNAME: "Solar park",
  WAREHOUSE: "Warehouse",
  WBSPERCENTAGE: "WBS %",
  ACTUALSTARTDATE: "Actual start",
  ACTUALENDDATE: "Actual end",
  CUSTOMERACCOUNT: "Customer account",
  APPROVALAUTHORITY: "Approval authority",
  STATUS: "Status",
  ENDCUSTOMERDESC: "End customer",
  PROJECTCONTOLLERPERSONNELNUMBER: "Project controller (PN)",
  PROJECTMANAGERPERSONNELNUMBER: "Project manager (PN)",
  SALESMANAGERPERSONNELNUMBER: "Sales manager (PN)",
  PROEJCTENDDATE: "Project end date",
  PROEJCTENDTIME: "Project end time",
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
  const [search, setSearch] = useState("");                                   // search by project name
  const [colFilters, setColFilters] = useState<Record<string, string>>({});   // per-column filters
  const [types, setTypes] = useState<string[]>([]);                           // PROJECTGROUP multiselect
  const [typeOpen, setTypeOpen] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const typeRef = useRef<HTMLDivElement>(null);

  // Close the type dropdown on outside click.
  useEffect(() => {
    if (!typeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [typeOpen]);

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

  // Fixed column set; only keep columns the DB view actually returns.
  const columns = useMemo(
    () => DISPLAY_COLUMNS.filter((c) => allColumns.length === 0 || allColumns.includes(c)),
    [allColumns]
  );

  const activeColFilters = useMemo(
    () => Object.entries(colFilters).filter(([, v]) => v.trim() !== ""),
    [colFilters]
  );

  // Search by name + per-column filters.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (q) {
        const name = String(p.name ?? p.raw?.PROJECTNAME ?? "").toLowerCase();
        const id = String(p.id ?? "").toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      if (types.length > 0) {
        const t = String(p.raw?.PROJECTGROUP ?? "").trim().toLowerCase();
        if (!types.some((sel) => sel.toLowerCase() === t)) return false;
      }
      for (const [col, raw] of activeColFilters) {
        const needle = raw.trim().toLowerCase();
        const v = p.raw?.[col];
        const hay = `${fmt(col, v)} ${v ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [projects, search, activeColFilters, types]);

  // Sorting (numeric-, date-, and text-aware; empties always last).
  const rows = useMemo(() => {
    if (!sort) return filtered;
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    const keyOf = (v: any): { empty: boolean; num?: number; str?: string } => {
      if (v === null || v === undefined || v === "") return { empty: true };
      if (typeof v === "number") return { empty: false, num: v };
      if (typeof v === "string" && ISO_DT.test(v)) return { empty: false, num: Date.parse(v.slice(0, 19)) };
      const n = Number(String(v).replace(/,/g, ""));
      if (String(v).trim() !== "" && !isNaN(n)) return { empty: false, num: n };
      return { empty: false, str: String(v).toLowerCase() };
    };
    return [...filtered].sort((a, b) => {
      const ka = keyOf(a.raw?.[col]);
      const kb = keyOf(b.raw?.[col]);
      if (ka.empty && kb.empty) return 0;
      if (ka.empty) return 1; // empties last regardless of direction
      if (kb.empty) return -1;
      if (ka.num !== undefined && kb.num !== undefined) return (ka.num - kb.num) * mul;
      if (ka.num !== undefined) return -1 * mul;
      if (kb.num !== undefined) return 1 * mul;
      return (ka.str! < kb.str! ? -1 : ka.str! > kb.str! ? 1 : 0) * mul;
    });
  }, [filtered, sort]);

  // Pagination keeps the DOM small so sort/filter re-renders stay fast.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage]
  );

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [search, colFilters, types, sort]);

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleSort = (col: string) =>
    setSort((prev) =>
      prev?.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : null // asc -> desc -> off
        : { col, dir: "asc" }
    );

  const setColFilter = (col: string, val: string) =>
    setColFilters((prev) => ({ ...prev, [col]: val }));

  const clearAll = () => {
    setSearch("");
    setColFilters({});
    setTypes([]);
    setSort(null);
  };

  const hasActive =
    search.trim() !== "" || activeColFilters.length > 0 || types.length > 0 || sort !== null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} of {projects.length} · {columns.length} columns
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Project type multiselect */}
          <div className="relative" ref={typeRef}>
            <button
              onClick={() => setTypeOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                types.length > 0 ? "border-brand text-brand" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Project group{types.length > 0 ? ` (${types.length})` : ""}
              <ChevronDown size={14} strokeWidth={2} />
            </button>
            {typeOpen && (
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400">
                  <span>{types.length} selected</span>
                  {types.length > 0 && (
                    <button onClick={() => setTypes([])} className="text-brand hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                {PROJECT_GROUPS.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(t)}
                      onChange={() => toggleType(t)}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    {t}
                  </label>
                ))}
              </div>
            )}
          </div>

          {hasActive && (
            <button
              onClick={clearAll}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
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
        <>
        {/* Height sized to show ~10 rows (plus the sticky header) and scroll beyond. */}
        <div className="card scrollbar-thin overflow-auto" style={{ maxHeight: "420px" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => {
                  const active = sort?.col === c;
                  return (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                      <button
                        onClick={() => toggleSort(c)}
                        className={`inline-flex items-center gap-1 hover:text-brand ${active ? "text-brand" : ""}`}
                        title="Sort"
                      >
                        {label(c)}
                        {active ? (
                          sort!.dir === "asc" ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />
                        ) : (
                          <ChevronsUpDown size={13} strokeWidth={2} className="text-slate-400" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {columns.map((c) => (
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
              {pageRows.map((p) => (
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                    No projects match the current search and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {rows.length > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
              >
                Prev
              </button>
              <span className="tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
