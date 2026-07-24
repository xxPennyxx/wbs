"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./frappe-gantt.css";
import { WbsTask } from "@/lib/types";

type ViewMode = "Day" | "Week" | "Month";

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  custom_class?: string;
}

function toGanttTasks(tasks: WbsTask[]): GanttTask[] {
  return tasks
    .filter((t) => t.startDate && t.endDate)
    .map((t) => {
      const start = t.startDate as string;
      let end = t.endDate as string;
      if (new Date(end) < new Date(start)) end = start;
      return {
        id: t.id.replace(/[^a-zA-Z0-9_]/g, "_"),
        name: `${t.wbsId ? t.wbsId + "  " : ""}${t.taskName}`.trim(),
        start,
        end,
        progress: Math.max(0, Math.min(100, t.progress ?? 0)),
        custom_class: t.isSummary ? "summary" : undefined,
      };
    });
}

export default function GanttChart({ tasks }: { tasks: WbsTask[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [err, setErr] = useState<string | null>(null);

  const ganttTasks = useMemo(() => toGanttTasks(tasks), [tasks]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    setErr(null);
    if (ganttTasks.length === 0) return;

    import("frappe-gantt")
      .then(({ default: Gantt }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        try {
          // eslint-disable-next-line no-new
          new Gantt(containerRef.current, ganttTasks as any, {
            view_mode: viewMode,
            date_format: "YYYY-MM-DD",
            bar_height: 16,
            bar_corner_radius: 2,
            padding: 10,
            column_width: viewMode === "Month" ? 90 : viewMode === "Week" ? 42 : 26,
            infinite_padding: false,
            readonly: true,
          } as any);
        } catch (e: any) {
          setErr(e?.message || String(e));
        }
      })
      .catch((e) => setErr(e?.message || String(e)));

    return () => {
      cancelled = true;
    };
  }, [ganttTasks, viewMode]);

  const modes: ViewMode[] = ["Day", "Week", "Month"];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Gantt</span>
        <span className="text-xs text-slate-400">
          {ganttTasks.length} of {tasks.length} tasks scheduled
        </span>
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

      {err && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Gantt error: {err}
        </div>
      )}

      {ganttTasks.length === 0 && !err && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No tasks have both a planned start and finish date, so there is nothing to plot.
          Check the “Planned start”/“Planned finish” columns in the WBS table.
        </div>
      )}

      {/* Container is always mounted so the chart can attach to it. */}
      <div ref={containerRef} className="gantt-container" />
    </div>
  );
}
