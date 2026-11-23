import { createLoader } from "nuqs/server";
import { filterParsers, isIsoDate, pickFilters } from "@/lib/filters";
import { housingTypeLabel, STAGE_LABELS } from "@/lib/format";
import { listProjects } from "@/lib/server/projects";
import { unitKind } from "@/lib/server/scope";
import { getToday } from "@/lib/server/today";

const load = createLoader(filterParsers);

const cell = (v: string | number | null) => {
  let s = v == null ? "" : String(v);
  // Text starting like a formula is neutralised so spreadsheets don't run it.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Any project list as CSV (SPEC §8, P2). Same rows and totals as /projects. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  for (const key of ["from", "to"]) {
    const v = url.searchParams.get(key);
    if (v !== null && !isIsoDate(v)) return new Response("Invalid date", { status: 404 });
  }
  const filters = pickFilters(load(request));
  const today = await getToday();
  const list = await listProjects(filters, today, { limit: null });
  const kind = unitKind(filters);
  const origin = new URL(request.url).origin;
  const header = ["address", "neighborhood", "housing_type", "stage", "permits", "units", "units_added", "units_removed", "main_permit", "link"];
  const lines = list.rows.map((p) =>
    [
      p.address,
      p.hoodName,
      housingTypeLabel(p.housingType),
      STAGE_LABELS[p.stage],
      p.permits,
      kind === "removed" ? p.removed : p.units,
      p.added,
      p.removed,
      p.mainPermit,
      `${origin}/project/${encodeURIComponent(p.mainPermit)}`,
    ]
      .map(cell)
      .join(","),
  );
  return new Response([header.join(","), ...lines].join("\n") + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="projects.csv"' },
  });
}
