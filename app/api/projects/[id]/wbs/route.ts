import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TABLES, WBS_COLUMNS } from "@/lib/schema";
import { getColumns, resolveColumn, quoteIdent } from "@/lib/introspect";
import { buildWbsTasks } from "@/lib/wbs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = decodeURIComponent(params.id);
  try {
    const projCol = await resolveColumn(TABLES.wbs, WBS_COLUMNS.projectId);
    const hCol = await resolveColumn(TABLES.wbs, ["HIERARCHYID"]);

    const table = quoteIdent(TABLES.wbs);
    const where = projCol ? `WHERE t.${quoteIdent(projCol)} = @pid` : "";
    const params2 = projCol ? { pid: projectId } : {};

    let rows: Record<string, any>[];
    let usedHierarchy = false;

    if (hCol) {
      const sqlH = `SELECT t.*, t.${quoteIdent(hCol)}.ToString() AS WBS_HPATH FROM ${table} AS t ${where}`;
      try {
        rows = await query<Record<string, any>>(sqlH, params2);
        usedHierarchy = true;
      } catch {
        rows = await query<Record<string, any>>(`SELECT t.* FROM ${table} AS t ${where}`, params2);
      }
    } else {
      rows = await query<Record<string, any>>(`SELECT t.* FROM ${table} AS t ${where}`, params2);
    }

    const tasks = buildWbsTasks(rows, projectId);

    // Ordered column list for the "All columns" view (hide the binary hierarchyid).
    const allCols = (await getColumns(TABLES.wbs).catch(() => [] as string[])).filter(
      (c) => c.toLowerCase() !== "hierarchyid"
    );

    return NextResponse.json({
      projectId,
      filteredBy: projCol,
      hierarchySource: usedHierarchy ? "HIERARCHYID" : "wbsId column",
      count: tasks.length,
      columns: allCols,
      tasks,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load WBS", detail: String(err) },
      { status: 500 }
    );
  }
}
