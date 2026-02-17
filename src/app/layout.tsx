import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Link from "next/link";

export const metadata: Metadata = {
  title: "Rize App",
  description: "Next-gen workout tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <nav className="sticky top-0 z-50 glass h-16 px-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
            RIZE
          </Link>
          <div className="flex gap-6 items-center">
            <Link href="/workout" className="text-sm font-medium hover:text-primary transition-colors">
              Train
            </Link>
            <Link href="/results" className="text-sm font-medium hover:text-primary transition-colors">
              Results
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto mesh-gradient min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
