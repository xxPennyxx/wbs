import sql from "mssql";

/**
 * Parse an ADO.NET / SQL Server style connection string such as:
 *   Server=host,1433;Database=db;User Id=user;Password=pw;Encrypt=false;TrustServerCertificate=true
 * into an mssql config object.
 */
function parseConnectionString(cs: string): sql.config {
  const parts = cs.split(";").filter(Boolean);
  const map: Record<string, string> = {};
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    map[key] = value;
  }

  // Server can be "host,port" or "host\\instance" or just "host".
  const serverRaw = map["server"] || map["data source"] || map["address"] || "";
  let server = serverRaw;
  let port: number | undefined;
  let instanceName: string | undefined;

  if (serverRaw.includes(",")) {
    const [host, portStr] = serverRaw.split(",");
    server = host.trim();
    port = parseInt(portStr.trim(), 10);
  } else if (serverRaw.includes("\\")) {
    const [host, instance] = serverRaw.split("\\");
    server = host.trim();
    instanceName = instance.trim();
  }

  const truthy = (v?: string) => /^(true|yes|1)$/i.test((v || "").trim());

  const config: sql.config = {
    server,
    port,
    database: map["database"] || map["initial catalog"],
    user: map["user id"] || map["uid"] || map["user"],
    password: map["password"] || map["pwd"],
    options: {
      encrypt: truthy(map["encrypt"]),
      trustServerCertificate: truthy(map["trustservercertificate"]) || truthy(map["trust server certificate"]),
      instanceName,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  };

  return config;
}

// Cache a single pool across hot reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __mssqlPool: Promise<sql.ConnectionPool> | undefined;
}

function getPool(): Promise<sql.ConnectionPool> {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    throw new Error("DATABASE_URL is not set. Create .env.local from .env.example.");
  }
  if (!global.__mssqlPool) {
    const config = parseConnectionString(cs);
    global.__mssqlPool = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        // Reset so the next request retries instead of caching a rejected promise.
        global.__mssqlPool = undefined;
        throw err;
      });
  }
  return global.__mssqlPool;
}

/** Run a parameterised query and return the recordset rows. */
export async function query<T = any>(
  text: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value as any);
  }
  const result = await request.query(text);
  return result.recordset as T[];
}

export { sql };
