import "server-only";
import type { SubscriptionStatus } from "./notifications";
import { siteOrigin } from "./notifications";

/** Back to the place report with the outcome shown beside its signup form, or to /subscribe when there's no place. */
export function redirectWithStatus(request: Request, path: string | null, status: SubscriptionStatus): Response {
  const url = new URL(path ?? "/subscribe", siteOrigin() ?? request.url);
  url.searchParams.set("subscription", status);
  if (path) url.hash = "updates";
  return Response.redirect(url, 303);
}
