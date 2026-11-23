import { Info } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * What a number or label counts, in place (SPEC T6). Opens on tap as well as click, so it
 * works on phones, and links to the matching part of the About page.
 */
export function InfoTip({
  children,
  anchor,
  label = "What this counts",
  className,
}: {
  children: React.ReactNode;
  anchor: string;
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2 text-sm leading-relaxed">
        <div>{children}</div>
        <Link href={`/about#${anchor}`} className="text-primary underline underline-offset-2">
          About the data
        </Link>
      </PopoverContent>
    </Popover>
  );
}
