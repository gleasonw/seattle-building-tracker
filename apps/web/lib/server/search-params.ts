import "server-only";
import { createSearchParamsCache, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { SUBSCRIPTION_MESSAGES, type SubscriptionMessage } from "@/components/subscribe-form";
import { filterParsers, listParsers, parseAsIsoDate, reportParsers, whereParsers } from "@/lib/filters";

export const filtersCache = createSearchParamsCache({ ...filterParsers, ...listParsers, asof: parseAsIsoDate });
export const reportCache = createSearchParamsCache({
  ...whereParsers,
  ...reportParsers,
  label: parseAsString,
  /** Outcome of an email-updates signup, confirmation or unsubscribe (components/subscribe-form.tsx). */
  subscription: parseAsStringLiteral(Object.keys(SUBSCRIPTION_MESSAGES) as SubscriptionMessage[]),
});
