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
import PoseProvider from "~/components/PoseProvider";

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
        suppressHydrationWarning
      >
        <PoseProvider>
          <nav className="sticky top-0 z-50 glass h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-black tracking-tighter hover:opacity-80 transition-opacity italic text-primary">
                RIZE
              </Link>
              
              {/* Leader Status Pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-colors group cursor-default">
                <span className="text-sm">🇨🇦</span>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none">Global Lead</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold">Canada</span>
                    <span className="text-[10px] font-black text-success animate-pulse">+2.4k</span>
                  </div>
                </div>
              </div>
            </div>
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
        </PoseProvider>
      </body>
    </html>
  );
}
