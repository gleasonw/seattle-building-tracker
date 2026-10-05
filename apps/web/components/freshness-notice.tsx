import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFreshness } from "@/lib/server/metrics";

/** Last successful sync, with a warning when data is stale or the last sync failed (SPEC T5). */
export async function FreshnessNotice() {
  const { lastSuccessAt, lastRunStatus, stale } = await getFreshness();
  const last = lastSuccessAt ? new Date(lastSuccessAt) : null;
  const failed = lastRunStatus === "failed";

  const when = last
    ? last.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "never";

  return (
    <div className="flex flex-col gap-3">
      {(stale || failed) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{failed ? "The latest data update failed" : "Data may be out of date"}</AlertTitle>
          <AlertDescription>
            Numbers reflect the last successful update from the City ({when}).
          </AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground text-xs">
        Data from the{" "}
        <a href="https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr" className="underline underline-offset-2">
          Seattle Open Data Portal
        </a>
        , last updated {when}. <Link href="/methodology" className="underline underline-offset-2">What we count</Link>
      </p>
    </div>
  );
}
