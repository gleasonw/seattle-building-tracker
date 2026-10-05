"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { filterParsers, listParsers } from "@/lib/filters";
import type { MapPoint } from "@/lib/server/map";
import { cn } from "@/lib/utils";
import { LazyPermitMap } from "./lazy-permit-map";

export const DEFAULT_RADIUS_MILES = 0.5;

/** The filtered permits on a map; clicking the map narrows every number to a radius around that point (SPEC L1). */
export function FilteredPermitMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const [isPending, startTransition] = useTransition();
  const [f, setF] = useQueryStates({ ...filterParsers, page: listParsers.page }, { shallow: false, startTransition, scroll: false });
  const radius = f.lat != null && f.lng != null && f.r != null ? { lat: f.lat, lng: f.lng, miles: f.r } : null;
  return (
    <div className={cn("isolate overflow-hidden rounded-lg border", isPending && "opacity-70", className)}>
      <LazyPermitMap
        className="h-full w-full"
        points={points}
        radius={radius}
        onPick={(lat, lng) => void setF({ lat, lng, r: f.r ?? DEFAULT_RADIUS_MILES, page: null })}
      />
    </div>
  );
}
