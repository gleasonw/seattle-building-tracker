"use client";

import { Check, ChevronsUpDown, SlidersHorizontal, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState, useTransition } from "react";
import { HOUSING_TYPE_LABELS, HOUSING_TYPES, type HousingType } from "@sbt/data/domain/housing-type";
import { STATUS_CATEGORIES } from "@sbt/data/domain/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { filterParsers, MILESTONES, UNIT_KINDS, type Milestone, type UnitKind } from "@/lib/filters";
import { RadiusPicker } from "@/components/radius-picker";
import { STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[] | null) => void;
}) {
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next.length ? next : null);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2">
          {label}
          {selected.length > 0 && <Badge variant="secondary">{selected.length}</Badge>}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          {options.length > 8 && <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <Check className={cn(selected.includes(o.value) ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Text input that commits to the URL on blur or Enter, not on every keystroke. */
function CommitInput({
  id,
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <Input
      id={id}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
      {...props}
    />
  );
}

export function FilterBar({
  areas,
  subTypes,
  showMilestone = false,
  showStatus = false,
  showDates = true,
}: {
  areas: Option[];
  subTypes: string[];
  showMilestone?: boolean;
  showStatus?: boolean;
  showDates?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [f, setF] = useQueryStates(filterParsers, { shallow: false, startTransition, scroll: false });
  const set = (patch: Parameters<typeof setF>[0]) => void setF(patch);

  const areaName = new Map(areas.map((a) => [a.value, a.label]));
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(f.type ?? []).map((t) => ({
      key: `type-${t}`,
      label: HOUSING_TYPE_LABELS[t],
      clear: () => set({ type: f.type!.filter((x) => x !== t).length ? f.type!.filter((x) => x !== t) : null }),
    })),
    ...(f.area ?? []).map((a) => ({
      key: `area-${a}`,
      label: areaName.get(a) ?? a,
      clear: () => set({ area: f.area!.filter((x) => x !== a).length ? f.area!.filter((x) => x !== a) : null }),
    })),
    ...(showStatus ? (f.status ?? []) : []).map((s) => ({
      key: `status-${s}`,
      label: STATUS_LABELS[s] ?? s,
      clear: () => set({ status: f.status!.filter((x) => x !== s).length ? f.status!.filter((x) => x !== s) : null }),
    })),
    ...(f.sub ?? []).map((s) => ({
      key: `sub-${s}`,
      label: s,
      clear: () => set({ sub: f.sub!.filter((x) => x !== s).length ? f.sub!.filter((x) => x !== s) : null }),
    })),
    ...(f.min != null ? [{ key: "min", label: `≥ ${f.min} units`, clear: () => set({ min: null }) }] : []),
    ...(f.lat != null && f.lng != null && f.r != null
      ? [{ key: "radius", label: `Within ${f.r} mi of ${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`, clear: () => set({ lat: null, lng: null, r: null }) }]
      : []),
    ...(showDates && (f.from || f.to)
      ? [{ key: "dates", label: `${f.from ?? "start"} → ${f.to ?? "today"}`, clear: () => set({ from: null, to: null }) }]
      : []),
  ];

  const controls = (
    <>
        <MultiSelect
          label="Housing type"
          options={HOUSING_TYPES.map((t) => ({ value: t, label: HOUSING_TYPE_LABELS[t as HousingType] }))}
          selected={f.type ?? []}
          onChange={(type) => set({ type: type as HousingType[] | null })}
        />
        <MultiSelect label="Area" options={areas} selected={f.area ?? []} onChange={(area) => set({ area })} />
        <MultiSelect
          label="Permit type"
          options={subTypes.map((s) => ({ value: s, label: s }))}
          selected={f.sub ?? []}
          onChange={(sub) => set({ sub })}
        />
        <RadiusPicker
          value={f.lat != null && f.lng != null && f.r != null ? { lat: f.lat, lng: f.lng, miles: f.r } : null}
          onChange={(v) => set(v ? { lat: v.lat, lng: v.lng, r: Number(v.miles.toFixed(2)) } : { lat: null, lng: null, r: null })}
        />
        {showStatus && (
          <MultiSelect
            label="Status"
            options={STATUS_CATEGORIES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
            selected={f.status ?? []}
            onChange={(status) => set({ status: status as typeof f.status })}
          />
        )}
        {showDates && (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="from" className="text-muted-foreground text-xs">From</Label>
              <CommitInput id="from" type="date" className="h-8 w-36" value={f.from ?? ""} onCommit={(v) => set({ from: v || null })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="to" className="text-muted-foreground text-xs">To</Label>
              <CommitInput id="to" type="date" className="h-8 w-36" value={f.to ?? ""} onCommit={(v) => set({ to: v || null })} />
            </div>
          </>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="min" className="text-muted-foreground text-xs">Min units</Label>
          <CommitInput
            id="min"
            type="number"
            min={1}
            className="h-8 w-24"
            value={f.min != null ? String(f.min) : ""}
            onCommit={(v) => set({ min: v ? Math.max(1, Number.parseInt(v, 10)) : null })}
          />
        </div>
        {showMilestone && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Dates refer to</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={f.on ?? "completed"}
              onValueChange={(v) => v && set({ on: v as Milestone })}
            >
              {MILESTONES.map((m) => (
                <ToggleGroupItem key={m} value={m} className="capitalize">
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {showMilestone && (f.on ?? "completed") === "completed" && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Units</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={f.units ?? "net"}
              onValueChange={(v) => v && set({ units: v === "net" ? null : (v as UnitKind) })}
            >
              {UNIT_KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k} className="capitalize">
                  {k}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-3", isPending && "opacity-70 transition-opacity")}>
      <div className="hidden flex-wrap items-end gap-3 md:flex">{controls}</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="w-fit md:hidden">
            <SlidersHorizontal />
            Filters
            {chips.length > 0 && <Badge variant="secondary">{chips.length}</Badge>}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-start gap-4 px-4 pb-6">{controls}</div>
        </SheetContent>
      </Sheet>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className="gap-1 pr-1">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={`Remove ${c.label}`} className="rounded-full hover:bg-background/60">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ type: null, area: null, status: null, sub: null, min: null, lat: null, lng: null, r: null, from: null, to: null })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
