"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { WbsTask } from "@/lib/types";
import WbsTable from "@/components/WbsTable";

const GanttChart = dynamic(() => import("@/components/GanttChart"), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-slate-400">Loading Gantt…</div>,
});

type Tab = "gantt" | "table";

export default function ProjectWbsPage() {
  const params = useParams<{ id: string }>();
  const projectId = decodeURIComponent(params.id);

  const [tasks, setTasks] = useState<WbsTask[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("gantt");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/wbs`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      })
      .then((data) => {
        setTasks(data.tasks);
        setColumns(data.columns || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const withDates = tasks.filter((t) => t.startDate && t.endDate).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Projects
        </Link>
        <h1 className="text-lg font-semibold text-slate-800">{projectId}</h1>
        <span className="text-sm text-slate-500">
          {tasks.length} WBS rows · {withDates} scheduled
        </span>

        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-300">
          {(["gantt", "table"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1 text-sm ${tab === t ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t === "gantt" ? "Gantt" : "WBS table"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-medium">Could not load the work-breakdown structure.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading work-breakdown structure…</div>
      ) : tab === "gantt" ? (
        <GanttChart tasks={tasks} />
      ) : (
        <WbsTable tasks={tasks} columns={columns} />
      )}
    </div>
  );
}
