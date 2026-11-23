"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/", label: "This year", match: (p: string) => p === "/" },
  { href: "/search", label: "Places", match: (p: string) => /^\/(search|place|near)/.test(p) },
  { href: "/about", label: "About the data", match: (p: string) => p.startsWith("/about") },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
      {VIEWS.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          aria-current={v.match(pathname) ? "page" : undefined}
          className={cn(
            "hover:bg-muted rounded-lg px-3 py-2 transition-colors",
            v.match(pathname) ? "bg-muted text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
