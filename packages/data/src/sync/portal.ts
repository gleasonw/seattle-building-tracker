/**
 * Client for the Seattle Open Data Building Permits dataset (SODA API).
 * https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr
 */
import type { SourceRecord } from "../domain/normalize";

export const PORTAL_ENDPOINT = "https://data.seattle.gov/resource/76t5-zqzr.json";

/** Permit types imported. Everything else (roof, grading, exemptions) is out of scope. */
export const IMPORT_WHERE = "permittypemapped in ('Building','Demolition')";

const PAGE_SIZE = 10_000;
const RETRIES = 4;

function buildUrl(params: Record<string, string>) {
  const url = new URL(PORTAL_ENDPOINT);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const token = process.env.SEATTLE_PERMITS_APP_TOKEN;
  if (token) url.searchParams.set("$$app_token", token);
  return url;
}

export async function soql<T>(params: Record<string, string>): Promise<T[]> {
  const url = buildUrl(params);
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Portal returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body: unknown = await res.json();
      if (!Array.isArray(body)) throw new Error(`Unexpected portal response: ${JSON.stringify(body).slice(0, 300)}`);
      return body as T[];
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export async function countSource(): Promise<number> {
  const [row] = await soql<{ count: string }>({ $select: "count(*)", $where: IMPORT_WHERE });
  return Number(row?.count ?? NaN);
}

/**
 * Yields every in-scope record in pages, using keyset pagination on the portal's row id
 * so pages can't skip or duplicate rows.
 */
export async function* fetchAllRecords(): AsyncGenerator<SourceRecord[]> {
  let lastId: string | null = null;
  for (;;) {
    const where: string = lastId ? `${IMPORT_WHERE} AND :id > '${lastId}'` : IMPORT_WHERE;
    const page = await soql<SourceRecord>({
      $select: "*,:id",
      $where: where,
      $order: ":id",
      $limit: String(PAGE_SIZE),
    });
    if (page.length === 0) return;
    yield page;
    if (page.length < PAGE_SIZE) return;
    lastId = page[page.length - 1]![":id"]!;
  }
}
