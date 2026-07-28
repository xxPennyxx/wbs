"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { WbsTask } from "@/lib/types";

type ViewMode = "Day" | "Week" | "Month";

/* ---------------------------------------------------------------- layout */
const ROW_H = 40;             // height of one WBS row
const BAR_H = 11;             // height of a single bar
const HEADER_H = 52;          // two-tier date header (upper = year, lower = period)
const LEFT_W = 340;           // task-name panel width

// Pixels per day for each view mode (drives column width + bar positioning).
const PX_PER_DAY: Record<ViewMode, number> = {
  Day: 34,
  Week: 60 / 7,
  Month: 120 / 30.4375,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------- bar colours */
// Three clearly distinct hues so Planned / Actual / Progress are easy to tell apart.
const PLANNED_FILL = "#93c5fd";          // blue-300  (planned)
const PLANNED_FILL_SUMMARY = "#bfdbfe";  // blue-200
const PLANNED_STROKE = "#3b82f6";        // blue-500

const ACTUAL_FILL = "#22c55e";           // green-500 (actual / completed)
const ACTUAL_STROKE = "#16a34a";         // green-600

const PROGRESS_TRACK = "#fde68a";        // amber-200 (in-progress track)
const PROGRESS_FILL = "#f59e0b";         // amber-500 (in-progress completed %)
const PROGRESS_STROKE = "#d97706";       // amber-600

/* ------------------------------------------------------------- date utils */
function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function startOfWeek(d: Date): Date {
  // Monday as first day of the week (Indian project-tracking convention).
  const diff = (d.getDay() + 6) % 7;
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -diff);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function fmtDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

interface Tick {
  x: number;
  w: number;
  label: string;
  weekend?: boolean;
}

/** Build the lower (period) ticks and upper (year/month) ticks. */
function buildTicks(from: Date, to: Date, mode: ViewMode, pxPerDay: number) {
  const xOf = (d: Date) => daysBetween(from, d) * pxPerDay;
  const lower: Tick[] = [];
  const upperMap = new Map<string, Tick>();

  const bumpUpper = (key: string, x: number, w: number, label: string) => {
    const e = upperMap.get(key);
    if (!e) upperMap.set(key, { x, w, label });
    else e.w = x + w - e.x;
  };

  if (mode === "Day") {
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const x = xOf(d);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      lower.push({ x, w: pxPerDay, label: String(d.getDate()), weekend });
      // Upper tier: month + year, always includes the year.
      bumpUpper(`${d.getFullYear()}-${d.getMonth()}`, x, pxPerDay, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    }
  } else if (mode === "Week") {
    for (let d = startOfWeek(from); d <= to; d = addDays(d, 7)) {
      const x = xOf(d);
      const w = pxPerDay * 7;
      lower.push({ x, w, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` });
      bumpUpper(`${d.getFullYear()}-${d.getMonth()}`, x, w, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    }
  } else {
    // Month
    for (let d = startOfMonth(from); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const x = xOf(d);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const w = daysBetween(d, next) * pxPerDay;
      lower.push({ x, w, label: MONTHS[d.getMonth()] });
      // Upper tier: the year.
      bumpUpper(`${d.getFullYear()}`, x, w, String(d.getFullYear()));
    }
  }

  return { lower, upper: Array.from(upperMap.values()) };
}

/* ------------------------------------------------------------- component */
/* -------------------------------------------------------------- HTML export */
// Curated CSS props copied so the exported file looks like the on-screen chart
// without bloating the file with all ~350 computed properties per node.
const EXPORT_PROPS = [
  "display", "position", "top", "left", "right", "bottom", "float",
  "flex-direction", "align-items", "justify-content", "flex", "flex-shrink",
  "width", "height", "min-width", "max-width", "box-sizing",
  "margin", "padding", "padding-left", "padding-right", "padding-top", "padding-bottom",
  "border", "border-color", "border-width", "border-style", "border-radius", "border-right", "border-bottom",
  "background-color", "color", "font-family", "font-size", "font-weight", "line-height",
  "text-align", "text-transform", "letter-spacing", "white-space", "overflow", "vertical-align",
  "box-shadow",
];

function inlineStyles(src: Element, clone: Element) {
  if (src instanceof HTMLElement && clone instanceof HTMLElement) {
    const cs = getComputedStyle(src);
    let style = "";
    for (const p of EXPORT_PROPS) {
      const v = cs.getPropertyValue(p);
      if (v && v !== "none" && v !== "normal") style += `${p}:${v};`;
    }
    clone.setAttribute("style", style);
  }
  const sc = src.children;
  const cc = clone.children;
  for (let i = 0; i < sc.length; i++) inlineStyles(sc[i], cc[i]);
}

export default function GanttChart({ tasks, projectId = "Gantt" }: { tasks: WbsTask[]; projectId?: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const exportRef = useRef<HTMLDivElement>(null);

  // Fetch the FPEL logo and inline it as a data URI so the export is self-contained.
  const logoDataUri = async (): Promise<string> => {
    try {
      const res = await fetch("/FPEL.png");
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(String(fr.result));
        fr.onerror = () => resolve("");
        fr.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  const exportHtml = async () => {
    const src = exportRef.current;
    if (!src) return;
    const clone = src.cloneNode(true) as HTMLElement;
    inlineStyles(src, clone);
    // Show the whole chart in the static file (no inner scroll / clipping).
    clone.style.maxHeight = "none";
    clone.style.overflow = "visible";
    const logo = await logoDataUri();
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
    const html =
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>Fourth Partner Energy Private Limited — Gantt ${projectId}</title>` +
      `<style>body{margin:0;padding:28px 32px;font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;color:#1e293b;background:#f8fafc;}` +
      `.hd{display:flex;align-items:center;gap:16px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px;}` +
      `.hd img{height:44px;width:auto;}` +
      `.hd h1{font-size:18px;font-weight:700;margin:0;letter-spacing:-0.01em;color:#0f172a;}` +
      `.hd p{font-size:12px;color:#64748b;margin:3px 0 0;}` +
      `svg{display:block;}</style></head><body>` +
      `<div class="hd">${logo ? `<img src="${logo}" alt="Fourth Partner Energy"/>` : ""}` +
      `<div><h1>Fourth Partner Energy Private Limited</h1>` +
      `<p>Gantt chart — ${projectId} &nbsp;·&nbsp; Planned (blue) · Actual (green) · Progress (amber) &nbsp;·&nbsp; exported ${stamp}</p></div></div>` +
      clone.outerHTML +
      `</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Gantt_${projectId.replace(/[^A-Za-z0-9_-]+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Rows that have at least one plottable bar (planned OR actual).
  const rows = useMemo(() => {
    return tasks
      .map((t) => {
        const ps = parseISO(t.startDate);
        let pe = parseISO(t.endDate);
        if (ps && pe && pe < ps) pe = ps;
        const as = parseISO(t.actualStartDate);
        let ae = parseISO(t.actualEndDate);
        if (as && ae && ae < as) ae = as;
        return { t, ps, pe, as, ae };
      })
      .filter((r) => (r.ps && r.pe) || r.as); // planned pair, or anything with an actual start
  }, [tasks]);

  const range = useMemo(() => {
    const all: Date[] = [];
    let hasInProgress = false;
    for (const r of rows) {
      if (r.ps) all.push(r.ps);
      if (r.pe) all.push(r.pe);
      if (r.as) all.push(r.as);
      if (r.ae) all.push(r.ae);
      if (r.as && !r.ae) hasInProgress = true;
    }
    // In-progress bars run to "today", so make sure the range covers it.
    if (hasInProgress) all.push(new Date());
    if (all.length === 0) return null;
    let min = all[0];
    let max = all[0];
    for (const d of all) {
      if (d < min) min = d;
      if (d > max) max = d;
    }
    // Snap to whole months so the first/last month always render in full
    // (e.g. all of Nov 2021 even when the project starts late in the month),
    // which also keeps week/day tick labels from colliding at the edges.
    return { from: startOfMonth(min), to: endOfMonth(max) };
  }, [rows]);

  const pxPerDay = PX_PER_DAY[viewMode];

  // Midnight-today, used to draw the running end of in-progress bars.
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const { ticks, width, xOf, todayX } = useMemo(() => {
    if (!range) return { ticks: { lower: [], upper: [] }, width: 0, xOf: (_: Date) => 0, todayX: null as number | null };
    const xOf = (d: Date) => daysBetween(range.from, d) * pxPerDay;
    const width = Math.max(daysBetween(range.from, range.to) * pxPerDay, 300);
    const ticks = buildTicks(range.from, range.to, viewMode, pxPerDay);
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tx = t0 >= range.from && t0 <= range.to ? xOf(t0) : null;
    return { ticks, width, xOf, todayX: tx };
  }, [range, viewMode, pxPerDay]);

  const modes: ViewMode[] = ["Day", "Week", "Month"];
  const bodyH = rows.length * ROW_H;

  return (
    <div>
      {/* controls + legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Gantt</span>
        <span className="text-xs text-slate-400">
          {rows.length} of {tasks.length} tasks scheduled
        </span>

        <div className="ml-2 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: PLANNED_FILL }} />
            Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: ACTUAL_FILL }} />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: PROGRESS_FILL }} />
            Progress
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-sm ${
                  viewMode === m ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {rows.length > 0 && (
            <button
              onClick={exportHtml}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Download size={14} strokeWidth={2} />
              Export HTML
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No tasks have a planned or actual start/finish date, so there is nothing to plot.
        </div>
      ) : (
        <div ref={exportRef} className="card scrollbar-thin relative overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
          <div style={{ width: LEFT_W + width, minWidth: "100%" }}>
            {/* ---------------- header row ---------------- */}
            <div className="sticky top-0 z-30 flex" style={{ height: HEADER_H }}>
              <div
                className="sticky left-0 z-40 flex items-end border-b border-r border-slate-200 bg-slate-50 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-500"
                style={{ width: LEFT_W }}
              >
                Task
              </div>
              <svg width={width} height={HEADER_H} className="block bg-slate-50">
                {/* upper tier (year / month-year) */}
                {ticks.upper.map((u, i) => (
                  <g key={`u${i}`}>
                    <line x1={u.x} y1={0} x2={u.x} y2={HEADER_H} stroke="#e2e8f0" strokeWidth={1} />
                    <text
                      // Clamp so edge labels (e.g. a short first/last month) stay fully visible
                      // instead of being clipped at the timeline edges.
                      x={Math.min(Math.max(u.x + u.w / 2, 42), width - 42)}
                      y={HEADER_H / 2 - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="#334155"
                    >
                      {u.label}
                    </text>
                  </g>
                ))}
                {/* lower tier (day / week / month) */}
                {ticks.lower.map((l, i) => (
                  <g key={`l${i}`}>
                    <text
                      x={Math.min(Math.max(l.x + l.w / 2, 24), width - 24)}
                      y={HEADER_H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill={l.weekend ? "#94a3b8" : "#64748b"}
                    >
                      {l.label}
                    </text>
                  </g>
                ))}
                <line x1={0} y1={HEADER_H - 0.5} x2={width} y2={HEADER_H - 0.5} stroke="#cbd5e1" strokeWidth={1} />
                <line x1={0} y1={HEADER_H / 2} x2={width} y2={HEADER_H / 2} stroke="#e2e8f0" strokeWidth={1} />
              </svg>
            </div>

            {/* ---------------- body row ---------------- */}
            <div className="flex">
              {/* left task list */}
              <div className="sticky left-0 z-20 border-r border-slate-200 bg-white" style={{ width: LEFT_W }}>
                {rows.map(({ t }, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center overflow-hidden ${t.isSummary ? "bg-slate-50 font-semibold text-slate-800" : "text-slate-700"}`}
                    style={{ height: ROW_H, borderBottom: "1px solid #f1f5f9" }}
                    title={`${t.wbsId ? t.wbsId + "  " : ""}${t.taskName}`}
                  >
                    <span className="shrink-0 pl-3 pr-2 text-xs tabular-nums text-slate-400" style={{ minWidth: 52 }}>
                      {t.wbsId || "—"}
                    </span>
                    <span className="truncate text-sm" style={{ paddingLeft: `${t.level * 14}px` }}>
                      {t.taskName}
                    </span>
                  </div>
                ))}
              </div>

              {/* timeline */}
              <svg width={width} height={bodyH} className="block">
                {/* weekend shading (Day mode only) */}
                {viewMode === "Day" &&
                  ticks.lower
                    .filter((l) => l.weekend)
                    .map((l, i) => (
                      <rect key={`wk${i}`} x={l.x} y={0} width={l.w} height={bodyH} fill="#f8fafc" />
                    ))}

                {/* vertical gridlines from upper ticks */}
                {ticks.upper.map((u, i) => (
                  <line key={`g${i}`} x1={u.x} y1={0} x2={u.x} y2={bodyH} stroke="#f1f5f9" strokeWidth={1} />
                ))}

                {/* row separators */}
                {rows.map((_, i) => (
                  <line key={`r${i}`} x1={0} y1={(i + 1) * ROW_H} x2={width} y2={(i + 1) * ROW_H} stroke="#f1f5f9" strokeWidth={1} />
                ))}

                {/* today marker */}
                {todayX !== null && (
                  <g>
                    <line x1={todayX} y1={0} x2={todayX} y2={bodyH} stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 3" />
                  </g>
                )}

                {/* bars */}
                {rows.map((r, i) => {
                  const top = i * ROW_H;
                  const plannedY = top + 7;
                  const actualY = top + ROW_H - 7 - BAR_H;
                  const els: JSX.Element[] = [];

                  const prog = Math.max(0, Math.min(100, r.t.progress ?? 0));

                  // Planned bar — planned start → planned end
                  if (r.ps && r.pe) {
                    const x = xOf(r.ps);
                    const w = Math.max(xOf(addDays(r.pe, 1)) - x, 2);
                    els.push(
                      <g key="p">
                        <rect
                          x={x}
                          y={plannedY}
                          width={w}
                          height={BAR_H}
                          rx={3}
                          fill={r.t.isSummary ? PLANNED_FILL_SUMMARY : PLANNED_FILL}
                          stroke={PLANNED_STROKE}
                          strokeWidth={0.5}
                        />
                        <title>{`Planned: ${fmtDMY(r.ps)} → ${fmtDMY(r.pe)}`}</title>
                      </g>
                    );
                  }

                  if (r.as && r.ae) {
                    // Completed — actual start → actual end
                    const x = xOf(r.as);
                    const w = Math.max(xOf(addDays(r.ae, 1)) - x, 2);
                    els.push(
                      <g key="a">
                        <rect x={x} y={actualY} width={w} height={BAR_H} rx={3} fill={ACTUAL_FILL} stroke={ACTUAL_STROKE} strokeWidth={0.5} />
                        <title>{`Actual: ${fmtDMY(r.as)} → ${fmtDMY(r.ae)}  ·  ${Math.round(prog)}% complete`}</title>
                      </g>
                    );
                  } else if (r.as) {
                    // In progress — started but not finished. Track runs actual start → today,
                    // with the completed % filled in.
                    const x = xOf(r.as);
                    const end = today > r.as ? today : addDays(r.as, 1);
                    const w = Math.max(xOf(end) - x, 2);
                    els.push(
                      <g key="ip">
                        <rect x={x} y={actualY} width={w} height={BAR_H} rx={3} fill={PROGRESS_TRACK} stroke={PROGRESS_STROKE} strokeWidth={0.5} />
                        {prog > 0 && (
                          <rect x={x} y={actualY} width={(w * prog) / 100} height={BAR_H} rx={3} fill={PROGRESS_FILL} />
                        )}
                        <title>{`In progress: started ${fmtDMY(r.as)}  ·  ${Math.round(prog)}% complete`}</title>
                      </g>
                    );
                  }

                  return <g key={r.t.id}>{els}</g>;
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
