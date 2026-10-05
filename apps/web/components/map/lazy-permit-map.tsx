"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet needs `window`, so the map only renders in the browser. */
export const LazyPermitMap = dynamic(() => import("./permit-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
