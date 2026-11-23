"use client";

import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { unitsCount } from "@/lib/format";
import { KIND_GROUP_LABELS, looksLikeAddress, matchPlaces, type PlaceOption } from "@/lib/search";
import { cn } from "@/lib/utils";

const searchHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

function placeSub(p: PlaceOption) {
  return p.kind === "neighborhood" ? `Neighborhood · ${p.district}` : `${p.district} · Comprehensive Plan`;
}

/** Matches grouped as neighborhoods, centers, and addresses (SPEC P2). */
function Results({ query, places, onPick }: { query: string; places: PlaceOption[]; onPick: (href: string) => void }) {
  const q = query.trim();
  if (!q) return null;
  const { neighborhoods, centers } = matchPlaces(q, places);
  const item = (p: PlaceOption) => (
    <CommandItem key={p.id} value={`place:${p.id}`} onSelect={() => onPick(`/place/${p.id}`)} className="min-h-12 gap-3 px-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{p.name}</span>
        <span className="text-muted-foreground truncate text-[13px]">{placeSub(p)}</span>
      </span>
      <span className="text-muted-foreground shrink-0 text-right text-[13px] tabular-nums">
        {unitsCount(p.pipelineUnits)} in pipeline
      </span>
    </CommandItem>
  );
  const addressFirst = looksLikeAddress(q);
  const addresses = (
    <CommandGroup heading="Addresses and streets" key="addresses">
      <CommandItem value={`search:${q}`} onSelect={() => onPick(searchHref(q))} className="min-h-12 gap-3 px-3">
        <MapPin className="text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">Search addresses for “{q}”</span>
          <span className="text-muted-foreground text-[13px]">Opens matching Seattle addresses and streets</span>
        </span>
      </CommandItem>
    </CommandGroup>
  );
  return (
    <>
      {addressFirst && addresses}
      {neighborhoods.length > 0 && <CommandGroup heading={KIND_GROUP_LABELS.neighborhood}>{neighborhoods.map(item)}</CommandGroup>}
      {centers.length > 0 && <CommandGroup heading={KIND_GROUP_LABELS.center}>{centers.map(item)}</CommandGroup>}
      {!addressFirst && addresses}
    </>
  );
}

/** The prominent "How's it going in…" search (front page and search page). */
export function PlaceSearch({
  places,
  initialQuery = "",
  autoFocus,
  className,
}: {
  places: PlaceOption[];
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const pick = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <Command shouldFilter={false} loop className={cn("relative h-auto overflow-visible bg-transparent p-0", className)}>
      <div className="border-primary bg-card flex h-13 items-center gap-2.5 rounded-xl border-2 px-3.5">
        <Search className="text-muted-foreground size-5 shrink-0" aria-hidden />
        <CommandPrimitive.Input
          id="place-search"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          autoFocus={autoFocus}
          placeholder="A neighborhood, urban village or address"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          aria-label="Search for a place"
        />
      </div>
      {open && query.trim() && (
        <CommandList className="bg-popover absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[60vh] rounded-xl border p-1.5 shadow-lg">
          <Results query={query} places={places} onPick={pick} />
        </CommandList>
      )}
    </Command>
  );
}

/** Search from the top of every page (SPEC §6): a button that opens the search in a dialog. */
export function HeaderSearch({ places }: { places: PlaceOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-muted-foreground h-10 gap-2 px-3 sm:w-64 sm:justify-start">
        <Search />
        <span className="hidden sm:inline">Search places…</span>
        <span className="sr-only sm:hidden">Search places</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search places"
        description="A neighborhood, urban village or address"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="A neighborhood, urban village or address"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !query.trim()) e.preventDefault();
            }}
          />
          <CommandList className="max-h-[60vh]">
            {!query.trim() && (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">Try Roosevelt, U District or 6716 Roosevelt Way NE</p>
            )}
            <Results
              query={query}
              places={places}
              onPick={(href) => {
                setOpen(false);
                setQuery("");
                router.push(href);
              }}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
