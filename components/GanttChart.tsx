"use client";

import { useMemo, useState } from "react";
import { WbsTask } from "@/lib/types";

type ViewMode = "Day" | "Week" | "Month";

/* ---------------------------------------------------------------- layout */
const ROW_H = 40;             // height of one WBS row
const BAR_H = 11;             // height of a single bar
const HEADER_H = 52;          // two-tier date header (upper = year, lower = period)
const LEFT_W = 340;           // task-name panel width
const PAD_DAYS = 3;           // padding on each side of the date range

// Pixels per day for each view mode (drives column width + bar positioning).
const PX_PER_DAY: Record<ViewMode, number> = {
  Day: 34,
  Week: 60 / 7,
  Month: 120 / 30.4375,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
export default function GanttChart({ tasks }: { tasks: WbsTask[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("Week");

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
      .filter((r) => (r.ps && r.pe) || (r.as && r.ae));
  }, [tasks]);

  const range = useMemo(() => {
    const all: Date[] = [];
    for (const r of rows) {
      if (r.ps) all.push(r.ps);
      if (r.pe) all.push(r.pe);
      if (r.as) all.push(r.as);
      if (r.ae) all.push(r.ae);
    }
    if (all.length === 0) return null;
    let min = all[0];
    let max = all[0];
    for (const d of all) {
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { from: addDays(min, -PAD_DAYS), to: addDays(max, PAD_DAYS) };
  }, [rows]);

  const pxPerDay = PX_PER_DAY[viewMode];

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
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "#5eead4" }} />
            Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "#0f766e" }} />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "#134e4a" }} />
            Progress
          </span>
        </div>

        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-300">
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
      </div>

      {rows.length === 0 ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No tasks have a planned or actual start/finish date, so there is nothing to plot.
        </div>
      ) : (
        <div className="relative overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "calc(100vh - 220px)" }}>
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
                      x={u.x + u.w / 2}
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
                      x={l.x + l.w / 2}
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

                  // Planned bar
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
                          fill={r.t.isSummary ? "#99f6e4" : "#5eead4"}
                          stroke="#2dd4bf"
                          strokeWidth={0.5}
                        />
                        <title>
                          {`Planned: ${fmtDMY(r.ps)} → ${fmtDMY(r.pe)}`}
                        </title>
                      </g>
                    );
                  }

                  // Actual bar (+ progress fill)
                  if (r.as && r.ae) {
                    const x = xOf(r.as);
                    const w = Math.max(xOf(addDays(r.ae, 1)) - x, 2);
                    const prog = Math.max(0, Math.min(100, r.t.progress ?? 0));
                    els.push(
                      <g key="a">
                        <rect x={x} y={actualY} width={w} height={BAR_H} rx={3} fill="#0f766e" />
                        {prog > 0 && (
                          <rect x={x} y={actualY} width={(w * prog) / 100} height={BAR_H} rx={3} fill="#134e4a" />
                        )}
                        <title>
                          {`Actual: ${fmtDMY(r.as)} → ${fmtDMY(r.ae)}  ·  ${Math.round(prog)}% complete`}
                        </title>
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
