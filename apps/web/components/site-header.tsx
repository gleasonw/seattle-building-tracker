"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/", label: "Output" },
  { href: "/bottlenecks", label: "Bottlenecks" },
  { href: "/stalled", label: "Stalled" },
  { href: "/permits", label: "Permits" },
  { href: "/methodology", label: "What we count" },
] as const;

/** Filters carry across views, so switching views keeps the same segment in focus. */
const SHARED_PARAMS = ["type", "area", "lat", "lng", "r", "min", "sub", "from", "to"];

export function SiteHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const shared = new URLSearchParams();
  for (const key of SHARED_PARAMS) for (const v of params.getAll(key)) shared.append(key, v);
  const qs = shared.toString();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Seattle Housing Tracker
        </Link>
        <nav className="flex gap-1 text-sm">
          {VIEWS.map((v) => {
            const active = v.href === "/" ? pathname === "/" : pathname.startsWith(v.href);
            return (
              <Link
                key={v.href}
                href={(qs && v.href !== "/methodology" ? `${v.href}?${qs}` : v.href)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors hover:bg-muted",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
