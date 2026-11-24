import { InvalidEmailError, InvalidPlaceError, requestSubscription, resolvePlace, type PlaceInput } from "@/lib/server/notifications";
import { redirectWithStatus } from "@/lib/server/subscription-redirect";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" && v.trim() !== "" ? v : null;
};

/** Signup form on a place report (SPEC P6). */
export async function POST(request: Request) {
  const form = await request.formData();
  const input: PlaceInput = {
    hood: field(form, "hood"),
    center: field(form, "center"),
    lat: field(form, "lat") == null ? null : Number(field(form, "lat")),
    lng: field(form, "lng") == null ? null : Number(field(form, "lng")),
    r: field(form, "r") == null ? null : Number(field(form, "r")),
    label: field(form, "label"),
  };
  let path: string | null = null;
  try {
    path = (await resolvePlace(input)).path;
    await requestSubscription(field(form, "email") ?? "", input);
    return redirectWithStatus(request, path, "check-email");
  } catch (error) {
    if (error instanceof InvalidEmailError) return redirectWithStatus(request, path, "invalid");
    if (error instanceof InvalidPlaceError) return redirectWithStatus(request, null, "invalid-link");
    console.error("Could not request a subscription", error);
    return redirectWithStatus(request, path, "unavailable");
  }
}
