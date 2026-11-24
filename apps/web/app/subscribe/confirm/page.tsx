import type { Metadata } from "next";
import { EmailActionCard } from "@/components/email-action-card";

export const metadata: Metadata = { title: "Confirm email updates", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <EmailActionCard
      title="Confirm email updates"
      description="Confirm to get an email after the nightly check of the City's permit data whenever projects in this place move."
      action="/api/subscribe/confirm"
      fields={token ? { token } : null}
      button="Confirm"
      incomplete="This confirmation link is incomplete. Copy the whole link from the email, or sign up again."
    />
  );
}
