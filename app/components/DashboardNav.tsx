"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const tabs = [
    { name: "Year in detail", href: "/" },
    { name: "Construction Trends", href: "/construction" },
    { name: "Application Trends ", href: "/applications" },
  ];

  return (
    <div className="flex gap-4 mb-8 border-b border-gray-200">
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
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
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
