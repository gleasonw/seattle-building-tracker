import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A titled block of a report page. */
export function Section({
  title,
  description,
  aside,
  children,
  className,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("min-w-0 gap-4 py-5 [--card-spacing:--spacing(5)] sm:py-6 sm:[--card-spacing:--spacing(6)]", className)}>
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-sm">{description}</CardDescription>}
        </div>
        {aside && <div className="text-muted-foreground text-sm">{aside}</div>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}
