"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
      <div className="mb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back to projects
        </Link>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{projectId}</h1>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-brand ring-1 ring-inset ring-teal-100">
                Project
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {tasks.length} WBS rows · {withDates} scheduled
            </p>
          </div>

          <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-300 shadow-sm">
            {(["gantt", "table"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {t === "gantt" ? "Gantt" : "WBS table"}
              </button>
            ))}
          </div>
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
        <GanttChart tasks={tasks} projectId={projectId} />
      ) : (
        <WbsTable tasks={tasks} columns={columns} projectId={projectId} />
      )}
    </div>
  );
}
