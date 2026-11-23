import { Badge } from "@/components/ui/badge";
import type { Stage } from "@/lib/filters";
import { STAGE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STAGE_STYLES: Record<Stage, string> = {
  proposal: "bg-muted text-muted-foreground",
  review: "bg-stage-review/20 text-foreground",
  issued: "bg-stage-issued/15 text-stage-issued",
  completed: "bg-primary/10 text-primary",
  expired: "bg-stage-stalled text-white dark:text-background",
  dead: "bg-muted text-muted-foreground",
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return <Badge className={cn("rounded-full font-semibold", STAGE_STYLES[stage], className)}>{STAGE_LABELS[stage]}</Badge>;
}

/** The flag column of a pipeline table: stalled, expiring soon or permit expired (SPEC P3). */
export function FlagBadge({ stage, stalled, expiring }: { stage: Stage; stalled: boolean; expiring: boolean }) {
  if (stage === "expired") return <StageBadge stage="expired" />;
  if (stalled)
    return <Badge className="bg-stage-review/25 text-stage-stalled rounded-full font-semibold dark:text-stage-review">Stalled</Badge>;
  if (expiring)
    return (
      <Badge variant="outline" className="border-stage-stalled/50 text-stage-stalled rounded-full font-semibold dark:text-stage-review">
        Expiring soon
      </Badge>
    );
  return <span className="text-muted-foreground">—</span>;
}
