import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { quoteIdent } from "@/lib/introspect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Source view for the Project Budget Analysis menu.
const BUDGET_VIEW = "ProjectBudgetBalanceReport";

// Ordered column list returned to the client (drives table column order).
// BUDGET is exposed under its report alias `TotalBudget`.
// (Kept local — Next.js route modules may only export route handlers/config.)
const BUDGET_COLUMNS = [
  "SOLARPARKNAME",
  "PROJID",
  "PROJECTNAME",
  "PROJGROUPID",
  "CATEGORYID",
  "ORIGINALBUDGET",
  "COMMITTEDREVISIONS",
  "TotalBudget",
  "UNCOMMITTEDREVISIONS",
  "WAREHOUSE",
  "SITE",
  "PROJECTMANGER",
  "CONSUMEDBUDGET",
  "COMMITTMENT",
  "REMAININGBUDGET",
  "TOTALBUDGETWP",
  "CAPACITYKWP",
  "CONSUMEDBUDGETWP",
  "REMAININGBUDGETWP",
  "STOCKAMOUNT",
  "COMPANY",
];

/**
 * GET /api/budget
 *
 * Runs the Project Budget Balance report for ALL companies (no company filter).
 * COMPANY is returned as a regular column so it can be sorted/filtered per-column
 * in the table like every other field.
 */
export async function GET() {
  try {
    const rows = await query<Record<string, any>>(
      `SELECT SOLARPARKNAME, PROJID, PROJECTNAME, PROJGROUPID, CATEGORYID,
              ORIGINALBUDGET, COMMITTEDREVISIONS, BUDGET AS TotalBudget,
              UNCOMMITTEDREVISIONS, WAREHOUSE, SITE, PROJECTMANGER,
              CONSUMEDBUDGET, COMMITTMENT, REMAININGBUDGET, TOTALBUDGETWP,
              CAPACITYKWP, CONSUMEDBUDGETWP, REMAININGBUDGETWP, STOCKAMOUNT,
              COMPANY
       FROM ${quoteIdent(BUDGET_VIEW)}`
    );

    return NextResponse.json({
      source: BUDGET_VIEW,
      count: rows.length,
      columns: BUDGET_COLUMNS,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load project budget report", detail: String(err) },
      { status: 500 }
    );
  }
}
