import { formatRange } from "@/lib/format";
import { LONG_VIEW_START, REVIEW_PREVIOUS_YEAR_MONTHS } from "@/lib/rules";

/** A year shown on the front page or a place report, and the stretch it's compared with (SPEC §2 "This year"). */
export interface Period {
  year: number;
  from: string;
  to: string;
  /** The current year so far, compared with the same dates last year. */
  ytd: boolean;
  /**
   * Still being revised by late-recorded completions (SPEC T3): this year so far, and last
   * year while it's shown in the months when last year is the default view.
   */
  provisional: boolean;
  previous: { from: string; to: string };
  /** "Year to date · 1 Jan – 21 Nov" or "Year in review · 1 Jan – 31 Dec 2025". */
  label: string;
}

const inReviewMonths = (today: string) => REVIEW_PREVIOUS_YEAR_MONTHS.includes(Number(today.slice(5, 7)));

export function periodFor(year: number, today: string): Period {
  const current = Number(today.slice(0, 4));
  if (year >= current) {
    const md = today.slice(5, 10);
    const to = `${current}-${md}`;
    return {
      year: current,
      from: `${current}-01-01`,
      to,
      ytd: true,
      provisional: true,
      previous: { from: `${current - 1}-01-01`, to: `${current - 1}-${md === "02-29" ? "02-28" : md}` },
      label: `Year to date · ${formatRange(`${current}-01-01`, to)}`,
    };
  }
  return {
    year,
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    ytd: false,
    provisional: year === current - 1 && inReviewMonths(today),
    previous: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    label: `Year in review · ${formatRange(`${year}-01-01`, `${year}-12-31`)} ${year}`,
  };
}

/**
 * The year a page shows: the one asked for, clamped to the years the app covers, or by
 * default this year, except in January, when there's too little of it to say much and the
 * previous year in review is shown instead (SPEC §2 "This year").
 */
export function resolveYear(requested: number | null | undefined, today: string): { year: number; earlyInYear: boolean } {
  const current = Number(today.slice(0, 4));
  if (requested != null && Number.isFinite(requested)) {
    return { year: Math.min(current, Math.max(LONG_VIEW_START, Math.trunc(requested))), earlyInYear: false };
  }
  return inReviewMonths(today) ? { year: current - 1, earlyInYear: true } : { year: current, earlyInYear: false };
}
