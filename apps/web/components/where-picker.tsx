"use client";

import { Check, MapPin } from "lucide-react";
import { useState } from "react";
import { LazyAreaMap, LazyPermitMap } from "@/components/map/lazy-permit-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AreaOption } from "@/lib/server/permits";
import { cn } from "@/lib/utils";

const DEFAULT_MILES = 0.5;

export interface RadiusValue {
  lat: number;
  lng: number;
  miles: number;
}

/**
 * "Where" (SPEC D3, L1): pick Community Reporting Areas on a map or from a list, or a radius
 * around a point. Area choices apply as soon as they're made; a radius applies on "Apply".
 */
export function WherePicker({
  areas,
  selectedAreas,
  onAreasChange,
  radius,
  onRadiusChange,
}: {
  areas: AreaOption[];
  selectedAreas: string[];
  onAreasChange: (next: string[] | null) => void;
  radius: RadiusValue | null;
  onRadiusChange: (v: RadiusValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"areas" | "radius">(radius && !selectedAreas.length ? "radius" : "areas");
  const [draft, setDraft] = useState<RadiusValue | null>(radius);

  const toggle = (id: string) => {
    const next = selectedAreas.includes(id) ? selectedAreas.filter((a) => a !== id) : [...selectedAreas, id];
    onAreasChange(next.length ? next : null);
  };

  const summary = [
    selectedAreas.length === 1
      ? areas.find((a) => a.id === selectedAreas[0])?.name
      : selectedAreas.length > 1
        ? `${selectedAreas.length} areas`
        : null,
    radius ? `within ${radius.miles} mi` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(radius);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-64 gap-2">
          <MapPin className="opacity-60" />
          <span className="truncate">{summary ? summary[0]!.toUpperCase() + summary.slice(1) : "Where"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[min(44rem,calc(100vw-2rem))] flex-col gap-3" align="start">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="areas">
              Areas
              {selectedAreas.length > 0 && <Badge variant="secondary">{selectedAreas.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="radius">Near a point</TabsTrigger>
          </TabsList>

          <TabsContent value="areas" className="flex flex-col gap-3 pt-2 sm:flex-row">
            <div className="isolate h-64 overflow-hidden rounded-md border sm:h-[28rem] sm:flex-1">
              <LazyAreaMap className="h-full w-full" areas={areas} selected={selectedAreas} onToggle={toggle} />
            </div>
            <Command className="h-48 rounded-md border sm:h-[28rem] sm:w-56">
              <CommandInput placeholder="Search areas…" />
              <CommandList className="max-h-none">
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandGroup>
                  {areas.map((a) => (
                    <CommandItem key={a.id} value={a.name} onSelect={() => toggle(a.id)}>
                      <Check className={cn(selectedAreas.includes(a.id) ? "opacity-100" : "opacity-0")} />
                      {a.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>

          <TabsContent value="radius" className="flex flex-col gap-3 pt-2">
            <p className="text-muted-foreground text-xs">
              Click the map to choose a point. Every number on the page will count only permits within the radius.
            </p>
            <div className="isolate h-80 overflow-hidden rounded-md border">
              <LazyPermitMap
                className="h-full w-full"
                radius={draft}
                onPick={(lat, lng) => setDraft({ lat, lng, miles: draft?.miles ?? DEFAULT_MILES })}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
                Radius {(draft?.miles ?? DEFAULT_MILES).toFixed(2)} mi
              </span>
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
              {radius && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onRadiusChange(null);
                    setDraft(null);
                  }}
                >
                  Remove radius
                </Button>
              )}
              <Button
                size="sm"
                disabled={!draft}
                onClick={() => {
                  onRadiusChange(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
