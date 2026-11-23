import Link from "next/link";
import { HeaderSearch } from "@/components/place-search";
import { SiteNav } from "@/components/site-nav";
import { formatDate } from "@/lib/format";
import { getFreshness } from "@/lib/server/metrics";
import { listPlaceOptions } from "@/lib/server/places";
import { getToday, seattleDate } from "@/lib/server/today";

/** Navigation, place search and the sync date on every page (SPEC P2, T5, §6). */
export async function SiteHeader() {
  const today = await getToday();
  const [places, freshness] = await Promise.all([listPlaceOptions(today), getFreshness()]);
  return (
    <header className="bg-card border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-bold tracking-tight">
          Seattle Building Tracker
        </Link>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <SiteNav />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground hidden text-xs lg:inline">
            Data synced {freshness.lastSuccessAt ? formatDate(seattleDate(new Date(freshness.lastSuccessAt))) : "never"}
          </span>
          <HeaderSearch places={places} />
        </div>
      </div>
    </header>
  );
}
