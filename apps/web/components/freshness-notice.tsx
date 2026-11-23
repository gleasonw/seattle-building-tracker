import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFreshness } from "@/lib/server/metrics";

/** Last successful sync, with a warning when data is stale or the last sync failed (SPEC T5). */
export async function FreshnessNotice() {
  await connection();
  const { lastSuccessAt, lastRunStatus, lastError, stale } = await getFreshness();
  const last = lastSuccessAt ? new Date(lastSuccessAt) : null;
  const failed = lastRunStatus === "failed";

  const when = last
    ? last.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      })
    : "never";

  return (
    <div className="flex flex-col gap-3">
      {(stale || failed) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{failed ? "The latest data update failed" : "Data may be out of date"}</AlertTitle>
          <AlertDescription>
            <p>Numbers reflect the last successful update from the City ({when}).</p>
            {failed && lastError && <p className="text-xs">Reason: {lastError}</p>}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground text-xs">
        Data from the City of Seattle&apos;s{" "}
        <a href="https://data.seattle.gov/Permitting/Building-Permits/76t5-zqzr" className="underline underline-offset-2">
          Building Permits dataset
        </a>
        , last synced {when}.{" "}
        <Link href="/about" className="underline underline-offset-2">
          About the data
        </Link>
      </p>
    </div>
  );
}
