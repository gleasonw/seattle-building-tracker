import { Camera } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Google Street View at a permit's location. Needs no API key. */
export function streetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/**
 * A street-level look at the site (SPEC L2). Imagery is often older than the permit, so it
 * may show the site before the work; the tooltip says so.
 */
export function StreetViewLink({ lat, lng, className }: { lat: number | null; lng: number | null; className?: string }) {
  if (lat == null || lng == null) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={streetViewUrl(lat, lng)}
          target="_blank"
          rel="noreferrer"
          className={cn("inline-flex items-center gap-0.5 hover:underline", className)}
        >
          Street View <Camera className="size-3" />
        </a>
      </TooltipTrigger>
      <TooltipContent>Opens Google Street View. Imagery may predate the permit and show the site before the work.</TooltipContent>
    </Tooltip>
  );
}
