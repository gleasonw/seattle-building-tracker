import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Where } from "@/lib/filters";

export const SUBSCRIPTION_MESSAGES = {
  "check-email": "Check your inbox for a confirmation link. Nothing is sent until you confirm.",
  confirmed: "You're signed up. You'll get an email after the nightly check whenever something here moves.",
  unsubscribed: "You've been unsubscribed from updates for this place.",
  invalid: "Enter a valid email address.",
  "invalid-link": "That link is invalid or has expired. Sign up again to get a new one.",
  unavailable: "Email updates aren't available right now. Please try again later.",
} as const;
export type SubscriptionMessage = keyof typeof SUBSCRIPTION_MESSAGES;

/** Signup for email updates about a place (SPEC P6). A plain form, so it works without JavaScript. */
export function SubscribeForm({
  where,
  label,
  placeName,
  status,
}: {
  where: Where;
  label: string;
  placeName: string;
  status?: SubscriptionMessage | null;
}) {
  const hidden: Record<string, string> = where.hood
    ? { hood: where.hood }
    : where.center
      ? { center: where.center }
      : { lat: String(where.lat), lng: String(where.lng), r: String(where.r), label };
  const bad = status === "invalid" || status === "invalid-link" || status === "unavailable";
  return (
    <div id="updates" className="bg-muted/40 scroll-mt-6 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <MailIcon aria-hidden className="size-4" />
          Get an email when projects here move
        </h3>
        <p className="text-muted-foreground text-sm">
          One email after the nightly check of the City&apos;s data, only on days something in {placeName} applies, is
          issued, completes, expires or dies. Confirm by email to start; unsubscribe from any email.
        </p>
      </div>
      <form action="/api/subscribe" method="post" className="mt-3 flex flex-wrap gap-2">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <Input
          id="subscribe-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={status === "invalid" || undefined}
          className="bg-background h-10 min-w-0 flex-[1_1_14rem]"
        />
        <Button type="submit" className="h-10 px-4">
          Sign up
        </Button>
      </form>
      {status && (
        <p role="status" className={bad ? "text-destructive mt-2 text-sm" : "mt-2 text-sm font-medium"}>
          {SUBSCRIPTION_MESSAGES[status]}
        </p>
      )}
    </div>
  );
}
