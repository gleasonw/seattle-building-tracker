import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "./components/QueryProvider";
import DataFooter from "./components/DataFooter";
import DashboardNav from "@/app/components/DashboardNav";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seattle Building Tracker",
  description: "Track Seattle building permits and housing unit completions",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30">
          <DataFooter />
        </div>
        <QueryProvider>
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto p-2 sm:p-4 lg:p-6">
              <h2 className="text-lg pb-3 font-bold">
                Seattle Building Tracker
              </h2>
              <Suspense>
                <DashboardNav />
              </Suspense>

              {children}
            </div>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
