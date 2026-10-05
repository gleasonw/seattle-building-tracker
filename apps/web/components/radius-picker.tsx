"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { LazyPermitMap } from "@/components/map/lazy-permit-map";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

const DEFAULT_MILES = 0.5;

export interface RadiusValue {
  lat: number;
  lng: number;
  miles: number;
}

/** "Near a place" (SPEC L1): click a point on the map and choose a radius. */
export function RadiusPicker({ value, onChange }: { value: RadiusValue | null; onChange: (v: RadiusValue | null) => void }) {
  const [draft, setDraft] = useState<RadiusValue | null>(value);
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MapPin className="opacity-60" />
          {value ? `Within ${value.miles} mi` : "Near a place"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-96 flex-col gap-3" align="start">
        <p className="text-muted-foreground text-xs">Click the map to choose a point. Every number on the page will count only permits within the radius.</p>
        <div className="isolate h-64 overflow-hidden rounded-md border">
          <LazyPermitMap
            className="h-full w-full"
            radius={draft}
            onPick={(lat, lng) => setDraft({ lat, lng, miles: draft?.miles ?? DEFAULT_MILES })}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">Radius {(draft?.miles ?? DEFAULT_MILES).toFixed(2)} mi</span>
          <Slider
            min={0.1}
            max={3}
            step={0.05}
            value={[draft?.miles ?? DEFAULT_MILES]}
            disabled={!draft}
            onValueChange={([miles]) => draft && setDraft({ ...draft, miles: miles! })}
          />
        </div>
        <div className="flex justify-end gap-2">
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button
            size="sm"
            disabled={!draft}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
