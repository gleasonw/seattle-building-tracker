import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A one-button page for links in emails. Confirming and unsubscribing take a click, so link
 * scanners that open every link in an email can't do either.
 */
export function EmailActionCard({
  title,
  description,
  action,
  fields,
  button,
  incomplete,
}: {
  title: string;
  description: React.ReactNode;
  action: string;
  fields: Record<string, string> | null;
  button: string;
  incomplete: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8">
      <Link href="/" className="text-primary text-sm">
        ← This year
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {fields ? (
            <form action={action} method="post">
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" size="lg">
                {button}
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">{incomplete}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
