import { confirmSubscription } from "@/lib/server/notifications";
import { redirectWithStatus } from "@/lib/server/subscription-redirect";

export async function POST(request: Request) {
  const token = (await request.formData()).get("token");
  let path: string | null = null;
  try {
    if (typeof token === "string") path = await confirmSubscription(token);
  } catch (error) {
    console.error("Could not confirm a subscription", error);
    return redirectWithStatus(request, null, "unavailable");
  }
  return redirectWithStatus(request, path, path ? "confirmed" : "invalid-link");
}
