import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ViewerProvider } from "@/components/viewer";
import { isGuest, optionalSession } from "@/server/auth";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lead Finder",
    template: "%s | Lead Finder",
  },
  description: "Discover local businesses and review potential website leads.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Presentation only: pages still guard themselves, and the API refuses a
  // guest's writes. A misconfigured secret must not take the layout down, so
  // a failure here renders as "not a guest".
  let guest = false;
  try {
    guest = isGuest(await optionalSession());
  } catch {
    guest = false;
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ViewerProvider guest={guest}>
          <AppShell>{children}</AppShell>
        </ViewerProvider>
      </body>
    </html>
  );
}
