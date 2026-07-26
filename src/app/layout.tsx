import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AppBackdrop } from "@/components/app-backdrop";
import { BottomNav } from "@/components/bottom-nav";
import { DataProvider } from "@/lib/data-context";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luris BnB",
  description:
    "Expense, income, and break-even tracking for 16 Weldon St — Luris BnB.",
  applicationName: "Luris BnB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Luris",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1e2a44",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppBackdrop />
        <DataProvider>
          {children}
          <BottomNav />
        </DataProvider>
      </body>
    </html>
  );
}
