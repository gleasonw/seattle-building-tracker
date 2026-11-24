import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBSCRIPTION_MESSAGES, type SubscriptionMessage } from "@/components/subscribe-form";

export const metadata: Metadata = { title: "Email updates", robots: { index: false } };

/** Where an email-updates action lands when it can't go back to a place report. */
export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ subscription?: string }> }) {
  const { subscription } = await searchParams;
  const message =
    subscription && subscription in SUBSCRIPTION_MESSAGES
      ? SUBSCRIPTION_MESSAGES[subscription as SubscriptionMessage]
      : "Sign up for email updates from any place's report.";
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Email updates</CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">{message}</CardDescription>
        </CardHeader>
      </Card>
      <Link href="/search" className="text-primary text-sm">
        Find a place →
      </Link>
    </div>
  );
}
