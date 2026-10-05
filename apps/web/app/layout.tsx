import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { FreshnessNotice } from "@/components/freshness-notice";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Seattle Housing Tracker",
  description: "Where Seattle is succeeding at building housing, and where it's getting stuck.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <NuqsAdapter>
          <TooltipProvider>
            <Suspense fallback={<header className="h-14 border-b" />}>
              <SiteHeader />
            </Suspense>
            <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">{children}</main>
            <footer className="mx-auto max-w-7xl px-4 pb-8">
              <Suspense>
                <FreshnessNotice />
              </Suspense>
            </footer>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
