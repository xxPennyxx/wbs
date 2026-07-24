import { WbsTask } from "./types";
import { WBS_COLUMNS, mapRow, pick } from "./schema";

function toIsoDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  const iso = d.toISOString().slice(0, 10);
  if (iso.startsWith("1900")) return null; // D365 null-date sentinel
  return iso;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}


/** First non-null/non-empty value among the candidate columns (case-insensitive). */
function firstNonNull(row: Record<string, any>, candidates: string[]): any {
  for (const c of candidates) {
    const v = pick(row, [c]);
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
}

/** Parse a hierarchy source ("/2/1/" or "2.1") into path segments. */
function toSegments(hpath: any, wbsId: any): string[] {
  if (hpath !== null && hpath !== undefined && String(hpath).trim() !== "") {
    return String(hpath).split("/").map((s) => s.trim()).filter((s) => s !== "");
  }
  if (wbsId !== null && wbsId !== undefined && String(wbsId).trim() !== "") {
    return String(wbsId).split(".").map((s) => s.trim()).filter((s) => s !== "");
  }
  return [];
}

function compareSegs(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const na = a[i] === undefined ? -1 : parseFloat(a[i]);
    const nb = b[i] === undefined ? -1 : parseFloat(b[i]);
    const va = isNaN(na) ? -1 : na;
    const vb = isNaN(nb) ? -1 : nb;
    if (va !== vb) return va - vb;
    if ((a[i] ?? "") !== (b[i] ?? "")) return (a[i] ?? "").localeCompare(b[i] ?? "");
  }
  return 0;
}

export function buildWbsTasks(rows: Record<string, any>[], projectId: string): WbsTask[] {
  const prepared = rows.map((r) => {
    const m = mapRow(r, WBS_COLUMNS);
    const hpath = pick(r, ["WBS_HPATH"]);
    const segs = toSegments(hpath, m.wbsId);
    const key = segs.join(".");
    // Drop the binary hierarchyid buffer from the raw row we send to the client.
    const { HIERARCHYID, hierarchyid, ...rawClean } = r as any;
    return { m, segs, key, raw: rawClean, hadHierarchy: (hpath ?? m.wbsId) != null };
  });

  const cleaned = prepared.filter((p) => p.hadHierarchy);
  const idOf = (key: string) => `${projectId}::${key || "root"}`;
  const keySet = new Set(cleaned.map((c) => c.key));
  const hasChild = new Set<string>();
  for (const c of cleaned) {
    if (c.segs.length > 0) {
      const parentKey = c.segs.slice(0, -1).join(".");
      if (keySet.has(parentKey)) hasChild.add(parentKey);
    }
  }

  return cleaned
    .sort((a, b) => compareSegs(a.segs, b.segs))
    .map((c) => {
      const m = c.m;
      const parentKey = c.segs.length > 0 ? c.segs.slice(0, -1).join(".") : null;
      const progressRaw = toNum(m.progress);
      return {
        id: idOf(c.key),
        wbsId: c.key,
        taskName: m.taskName != null ? String(m.taskName) : "",
        parentId: parentKey !== null && keySet.has(parentKey) ? idOf(parentKey) : null,
        level: Math.max(0, c.segs.length - 1),
        startDate: toIsoDate(firstNonNull(c.raw, WBS_COLUMNS.startDate)),
        endDate: toIsoDate(firstNonNull(c.raw, WBS_COLUMNS.endDate)),
        progress: progressRaw == null ? null : progressRaw <= 1 ? progressRaw * 100 : progressRaw,
        isSummary: hasChild.has(c.key),
        raw: c.raw,
      };
    });
}
