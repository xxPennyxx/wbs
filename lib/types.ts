export interface Project {
  id: string;
  name: string;
  raw: Record<string, any>;
}

export interface WbsTask {
  id: string;               // stable id for gantt (project + wbs path)
  wbsId: string;            // dotted display id, e.g. "2.1" ("" for root)
  taskName: string;
  parentId: string | null;  // derived from hierarchy
  level: number;            // indentation depth (0-based)
  startDate: string | null; // ISO yyyy-mm-dd (planned start)
  endDate: string | null;   // ISO yyyy-mm-dd (planned finish)
  progress: number | null;  // 0-100
  isSummary: boolean;
  raw: Record<string, any>; // full WBS row (all view columns)
}
