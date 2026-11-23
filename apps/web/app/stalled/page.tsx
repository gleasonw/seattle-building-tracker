import { permanentRedirect } from "next/navigation";

/** A dropped view (SPEC §7); its old links go to the front page. */
export default function DroppedPage() {
  permanentRedirect("/");
}
