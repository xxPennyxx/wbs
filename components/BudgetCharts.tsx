"use client";

import { useMemo } from "react";
import type { BudgetRow } from "@/lib/types";
import { toNum, fmtCompactINR, groupByProjectGroup } from "@/lib/budget";

// FPEL-ish palette.
const C = {
  consumed: "#0F766E", // brand
  commitment: "#F59E0B", // amber
  remaining: "#93C5FD", // light blue
  bar: "#14B8A6",
  track: "#E2E8F0",
  ink: "#334155",
  muted: "#94A3B8",
};

interface Props {
  // Project-level (category-collapsed) summary rows.
  summary: BudgetRow[];
}

/** Small card wrapper for a chart. */
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Legend swatch + label. */
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Donut showing how Total Budget splits into Consumed / Commitment / Remaining. */
function UtilisationDonut({
  consumed,
  commitment,
  remaining,
}: {
  consumed: number;
  commitment: number;
  remaining: number;
}) {
  const total = Math.max(consumed + commitment + remaining, 0);
  const size = 200;
  const r = 78;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const segs =
    total > 0
      ? [
          { v: consumed, color: C.consumed, label: "Consumed" },
          { v: commitment, color: C.commitment, label: "Commitment" },
          { v: remaining, color: C.remaining, label: "Remaining" },
        ]
      : [];

  let offset = 0;
  const consumedPct = total > 0 ? (consumed / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52" role="img" aria-label="Budget utilisation">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.track} strokeWidth={22} />
        {segs.map((s) => {
          const frac = s.v / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={22}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 26, fontWeight: 700 }}>
          {consumedPct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>
          consumed
        </text>
      </svg>
      <Legend
        items={[
          { color: C.consumed, label: `Consumed · ${fmtCompactINR(consumed)}` },
          { color: C.commitment, label: `Commitment · ${fmtCompactINR(commitment)}` },
          { color: C.remaining, label: `Remaining · ${fmtCompactINR(remaining)}` },
        ]}
      />
    </div>
  );
}

/** Horizontal bars: top projects by total budget, with consumed overlay. */
function TopProjectsBar({ rows }: { rows: BudgetRow[] }) {
  const top = rows.slice(0, 10);
  const max = Math.max(1, ...top.map((r) => toNum(r.TotalBudget)));
  const rowH = 30;
  const height = top.length * rowH + 10;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {top.map((r, i) => {
          const y = i * rowH + 6;
          const tot = toNum(r.TotalBudget);
          const con = toNum(r.CONSUMEDBUDGET);
          const totW = (tot / max) * 100;
          const conW = (con / max) * 100;
          return (
            <g key={String(r.PROJID) + i}>
              <rect x={0} y={y} width={totW} height={16} rx={2} fill={C.remaining} />
              <rect x={0} y={y} width={conW} height={16} rx={2} fill={C.consumed} />
            </g>
          );
        })}
      </svg>
      {/* Labels rendered as HTML for crisp text (SVG is stretched horizontally). */}
      <div className="mt-2 space-y-1">
        {top.map((r, i) => (
          <div key={String(r.PROJID) + "l" + i} className="flex items-center justify-between text-xs">
            <span className="truncate pr-2 text-slate-700" title={`${r.PROJID} · ${r.PROJECTNAME ?? ""}`}>
              {String(r.PROJID)} {r.PROJECTNAME ? `· ${r.PROJECTNAME}` : ""}
            </span>
            <span className="tabular-nums text-slate-500">
              {fmtCompactINR(toNum(r.CONSUMEDBUDGET))} / {fmtCompactINR(toNum(r.TotalBudget))}
            </span>
          </div>
        ))}
      </div>
      <Legend
        items={[
          { color: C.consumed, label: "Consumed" },
          { color: C.remaining, label: "Total budget" },
        ]}
      />
    </div>
  );
}

/** Vertical bars: total budget by project group. */
function GroupBar({ rows }: { rows: BudgetRow[] }) {
  const groups = groupByProjectGroup(rows).slice(0, 12);
  const max = Math.max(1, ...groups.map((g) => g.total));
  const width = 100;
  const chartH = 160;
  const n = groups.length || 1;
  const slot = width / n;
  const barW = Math.min(slot * 0.6, 8);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${chartH + 4}`} preserveAspectRatio="none" className="w-full" style={{ height: chartH + 4 }}>
        {groups.map((g, i) => {
          const h = (g.total / max) * chartH;
          const x = i * slot + (slot - barW) / 2;
          const y = chartH - h;
          return <rect key={g.name} x={x} y={y} width={barW} height={h} rx={1} fill={C.bar} />;
        })}
      </svg>
      <div className="mt-2 grid gap-1 text-xs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
        {groups.map((g) => (
          <div key={g.name} className="text-center leading-tight">
            <div className="truncate font-medium text-slate-700" title={g.name}>
              {g.name}
            </div>
            <div className="tabular-nums text-slate-500">{fmtCompactINR(g.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** KPI stat card. */
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

export default function BudgetCharts({ summary }: Props) {
  const totals = useMemo(() => {
    let total = 0,
      consumed = 0,
      commitment = 0,
      remaining = 0,
      capacity = 0;
    for (const r of summary) {
      total += toNum(r.TotalBudget);
      consumed += toNum(r.CONSUMEDBUDGET);
      commitment += toNum(r.COMMITTMENT);
      remaining += toNum(r.REMAININGBUDGET);
      capacity += toNum(r.CAPACITYKWP);
    }
    return { total, consumed, commitment, remaining, capacity };
  }, [summary]);

  if (summary.length === 0) {
    return <div className="card p-10 text-center text-slate-400">No budget data to chart.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Projects" value={summary.length.toLocaleString("en-IN")} />
        <Kpi label="Total budget" value={fmtCompactINR(totals.total)} />
        <Kpi label="Consumed" value={fmtCompactINR(totals.consumed)} />
        <Kpi label="Remaining" value={fmtCompactINR(totals.remaining)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Budget utilisation" subtitle="Consumed vs commitment vs remaining across the portfolio">
          <UtilisationDonut
            consumed={totals.consumed}
            commitment={totals.commitment}
            remaining={totals.remaining}
          />
        </ChartCard>

        <ChartCard title="Total budget by project group" subtitle="Sum of total budget per PROJGROUPID">
          <GroupBar rows={summary} />
        </ChartCard>
      </div>

      <ChartCard title="Top projects by total budget" subtitle="Top 10 projects · consumed (dark) vs total budget (light)">
        <TopProjectsBar rows={summary} />
      </ChartCard>

      <p className="text-xs text-slate-400">
        Amounts in INR. Consumption % = consumed ÷ total budget. Charts reflect the current company selection.
      </p>
    </div>
  );
}
