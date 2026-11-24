import { unsubscribe } from "@/lib/server/notifications";
import { redirectWithStatus } from "@/lib/server/subscription-redirect";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = form.get("id");
  const signature = form.get("signature");
  let path: string | null = null;
  try {
    if (typeof id === "string" && typeof signature === "string") path = await unsubscribe(id, signature);
  } catch (error) {
    console.error("Could not unsubscribe", error);
    return redirectWithStatus(request, null, "unavailable");
  }
  return redirectWithStatus(request, path, path ? "unsubscribed" : "invalid-link");
}
