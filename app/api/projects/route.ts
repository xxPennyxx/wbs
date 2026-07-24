import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TABLES, PROJECT_COLUMNS, WBS_COLUMNS, mapRow } from "@/lib/schema";
import { getColumns, resolveColumn, quoteIdent } from "@/lib/introspect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Preferred: the Projectmaster view (all columns returned).
    const projCols = await getColumns(TABLES.projects).catch(() => [] as string[]);

    if (projCols.length > 0) {
      const rows = await query<Record<string, any>>(
        `SELECT * FROM ${quoteIdent(TABLES.projects)}`
      );
      const projects = rows
        .map((r) => {
          const m = mapRow(r, PROJECT_COLUMNS);
          const id = m.id != null ? String(m.id).trim() : "";
          return { id, name: m.name != null ? String(m.name) : "", raw: r };
        })
        .filter((p) => p.id !== "");
      projects.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      return NextResponse.json({
        source: TABLES.projects,
        count: projects.length,
        columns: projCols,
        projects,
      });
    }

    // 2) Fallback: derive from the WBS table (only project id / name available).
    const pidCol = await resolveColumn(TABLES.wbs, WBS_COLUMNS.projectId);
    if (!pidCol) {
      throw new Error(
        `No projects table '${TABLES.projects}' found, and no project-id column in '${TABLES.wbs}'.`
      );
    }
    const nameCol = await resolveColumn(TABLES.wbs, WBS_COLUMNS.projectName);
    const selectCols = nameCol
      ? `${quoteIdent(pidCol)} AS PROJECTID, ${quoteIdent(nameCol)} AS PROJECTNAME`
      : `${quoteIdent(pidCol)} AS PROJECTID`;
    const rows = await query<{ PROJECTID: any; PROJECTNAME?: any }>(
      `SELECT DISTINCT ${selectCols} FROM ${quoteIdent(TABLES.wbs)} WHERE ${quoteIdent(pidCol)} IS NOT NULL`
    );
    const byId = new Map<string, any>();
    for (const r of rows) {
      const id = r.PROJECTID != null ? String(r.PROJECTID).trim() : "";
      if (!id || byId.has(id)) continue;
      const name = r.PROJECTNAME != null && String(r.PROJECTNAME).trim() !== "" ? String(r.PROJECTNAME) : id;
      byId.set(id, { id, name, raw: { PROJECTID: id, PROJECTNAME: name } });
    }
    const projects = Array.from(byId.values()).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    return NextResponse.json({
      source: `${TABLES.wbs} (derived)`,
      count: projects.length,
      columns: nameCol ? ["PROJECTID", "PROJECTNAME"] : ["PROJECTID"],
      projects,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load projects", detail: String(err) },
      { status: 500 }
    );
  }
}
