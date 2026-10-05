import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { explain, grade, type Support } from "@/lib/reliability";
import Link from "next/link";

/** Shows how many projects are behind a number and why it may be unreliable (SPEC T2). */
export function ReliabilityBadge({ support }: { support: Support }) {
  const r = grade(support);
  const label =
    r === "insufficient" ? "Not enough data" : r === "concentrated" ? "One project dominates" : `${support.projectCount.toLocaleString()} projects`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={r === "ok" ? "secondary" : "outline"} className={r === "ok" ? "" : "border-amber-500/50 text-amber-700 dark:text-amber-400"}>
          {r === "ok" ? <Info data-icon="inline-start" /> : <AlertTriangle data-icon="inline-start" />}
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p>{explain(support)}</p>
        <Link href="/methodology#reliability" className="underline underline-offset-2">
          How reliability works
        </Link>
      </TooltipContent>
    </Tooltip>
  );
}
