import { permanentRedirect } from "next/navigation";

/** The old permit explorer; project lists replace it (SPEC §7). */
export default function PermitsPage() {
  permanentRedirect("/");
}
