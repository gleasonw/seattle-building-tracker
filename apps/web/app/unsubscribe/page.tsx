import type { Metadata } from "next";
import { EmailActionCard } from "@/components/email-action-card";

export const metadata: Metadata = { title: "Stop email updates", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ id?: string; signature?: string }> }) {
  const { id, signature } = await searchParams;
  return (
    <EmailActionCard
      title="Stop email updates"
      description="You won't get any more emails about this place. Updates for other places you signed up for keep coming."
      action="/api/unsubscribe"
      fields={id && signature ? { id, signature } : null}
      button="Unsubscribe"
      incomplete="This unsubscribe link is incomplete. Copy the whole link from the email."
    />
  );
}
