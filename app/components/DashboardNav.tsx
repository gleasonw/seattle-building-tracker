"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const tabs = [
    { name: "Year in detail", href: "/" },
    { name: "Applications & Construction", href: "/applications" },
  ];

  return (
    <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const href =
          queryString && tab.href !== "/"
            ? `${tab.href}?${queryString}`
            : tab.href;
        return (
          <Link
            key={tab.href}
            href={href}
            className={`px-3 sm:px-4 py-2 border-b-2 font-medium text-sm sm:text-base whitespace-nowrap transition-colors ${
              isActive
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
