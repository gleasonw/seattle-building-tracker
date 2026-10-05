import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { PolicyEvent } from "@/lib/server/metrics";

/**
 * Numbered list matching the markers on a chart. Each event links to its primary source,
 * and none implies causation (SPEC V1).
 */
export function PolicyEventList({ events }: { events: PolicyEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="text-muted-foreground flex flex-col gap-1 text-xs">
      {events.map((e, i) => (
        <li key={`${e.date}-${e.label}`} className="flex gap-2">
          <span className="bg-muted text-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
            {i + 1}
          </span>
          <span>
            <span className="text-foreground font-medium">{e.label}</span>, {formatDate(e.date)}. {e.detail}{" "}
            <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
              Source <ExternalLink className="size-3" />
            </a>
          </span>
        </li>
      ))}
    </ol>
  );
}
