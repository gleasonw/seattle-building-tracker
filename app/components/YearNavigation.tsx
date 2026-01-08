"use client";

import Link from "next/link";

interface YearNavigationProps {
  currentYear: number;
  minYear?: number;
  maxYear?: number;
}

export default function YearNavigation({
  currentYear,
  minYear = 2010,
  maxYear = new Date().getFullYear(),
}: YearNavigationProps) {
  const hasPrevious = currentYear > minYear;
  const hasNext = currentYear < maxYear;
  const isCurrentYear = currentYear === maxYear;

  return (
    <div className="flex items-center gap-4 mb-6 text-sm">
      <Link
        href={`/?year=${currentYear - 1}`}
        className={`px-4 py-2 rounded-lg border transition-colors ${
          hasPrevious
            ? "border-gray-300 hover:bg-gray-100 text-gray-700"
            : "border-gray-200 text-gray-300 pointer-events-none"
        }`}
        aria-disabled={!hasPrevious}
      >
        ← Previous Year
      </Link>

      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-gray-900">{currentYear}</span>
      </div>

      <Link
        href={`/?year=${currentYear + 1}`}
        className={`px-4 py-2 rounded-lg border transition-colors ${
          hasNext
            ? "border-gray-300 hover:bg-gray-100 text-gray-700"
            : "border-gray-200 text-gray-300 pointer-events-none"
        }`}
        aria-disabled={!hasNext}
      >
        Next Year →
      </Link>

      {!isCurrentYear && (
        <Link
          href="/"
          className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Back to Current Year
        </Link>
      )}
    </div>
  );
}
