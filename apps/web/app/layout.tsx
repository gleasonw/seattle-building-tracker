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
  title: { default: "Seattle Building Tracker", template: "%s · Seattle Building Tracker" },
  description: "How Seattle is doing on housing this year, and how it's going in your neighborhood.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <NuqsAdapter>
          <TooltipProvider>
            <Suspense fallback={<header className="bg-card h-16 border-b" />}>
              <SiteHeader />
            </Suspense>
            <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 tabular-nums sm:px-6 sm:py-10">{children}</main>
            <footer className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
              {/* Not behind its own Suspense boundary: a streamed footer failed to hydrate, hiding the sync warning (T5). */}
              <FreshnessNotice />
            </footer>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
