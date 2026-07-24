import { query } from "./db";

const columnCache = new Map<string, string[]>();

/** Return the actual column names for a table/view (cached per process). */
export async function getColumns(table: string): Promise<string[]> {
  if (columnCache.has(table)) return columnCache.get(table)!;
  const rows = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION`,
    { t: table }
  );
  const cols = rows.map((r) => r.COLUMN_NAME);
  columnCache.set(table, cols);
  return cols;
}

/** Resolve the first candidate that exists as a real column (case-insensitive). */
export async function resolveColumn(
  table: string,
  candidates: string[]
): Promise<string | null> {
  const cols = await getColumns(table);
  const lower = new Map(cols.map((c) => [c.toLowerCase(), c]));
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** Safely bracket-quote a SQL identifier that came from a fixed whitelist. */
export function quoteIdent(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}
