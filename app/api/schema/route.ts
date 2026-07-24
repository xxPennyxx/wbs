import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getColumns } from "@/lib/introspect";
import { TABLES } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint. Shows:
 *  - every table/view in the database
 *  - the columns of any object whose name contains "project"
 *  - the columns of the tables configured in lib/schema.ts
 * Visit /api/schema in a browser.
 */
export async function GET() {
  const out: Record<string, any> = { configuredTables: TABLES };

  try {
    const all = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string; TABLE_TYPE: string }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
       FROM INFORMATION_SCHEMA.TABLES
       ORDER BY TABLE_TYPE, TABLE_NAME`
    );
    out.allObjects = all.map((t) => ({
      name: t.TABLE_NAME,
      schema: t.TABLE_SCHEMA,
      type: t.TABLE_TYPE,
    }));

    // Any object named like a project (excluding the WBS table itself),
    // with its full column list so we can map metadata columns.
    const candidates = out.allObjects.filter(
      (o: any) => /proj/i.test(o.name) && o.name.toLowerCase() !== TABLES.wbs.toLowerCase()
    );
    out.projectCandidates = candidates.map((o: any) => o.name);
    out.projectCandidateDetails = [];
    for (const o of candidates) {
      try {
        out.projectCandidateDetails.push({ name: o.name, type: o.type, columns: await getColumns(o.name) });
      } catch (err: any) {
        out.projectCandidateDetails.push({ name: o.name, error: err?.message || String(err) });
      }
    }
  } catch (err: any) {
    out.allObjects = { error: err?.message || String(err) };
  }

  for (const [key, table] of Object.entries(TABLES)) {
    try {
      out[key] = { table, columns: await getColumns(table) };
    } catch (err: any) {
      out[key] = { table, error: err?.message || String(err) };
    }
  }

  return NextResponse.json(out);
}
