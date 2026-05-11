import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/react';
import { TeamProvider } from "@/context/TeamContext";
import { LeagueProvider } from "@/context/LeagueContext";
import { SessionProvider } from "next-auth/react";
import { getLeagueId } from '@/lib/getLeagueId';
import { getLeagueRuleValue } from '@/lib/getLeagueInfo';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const leagueId = await getLeagueId();
    const leagueName = (await getLeagueRuleValue(leagueId, 'league_name')) || 'GFL';
    return {
      title: `${leagueName} League Manager`,
      description: `Manage rosters, trades, and more for the ${leagueName}.`,
    };
  } catch {
    return { title: 'GFL League Manager', description: 'Football League Manager' };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-gray-50`}
        suppressHydrationWarning={true}
      >
        <SessionProvider>
          <LeagueProvider>
            <TeamProvider>
              <Navbar />
              <main className="min-h-screen">
                {children}
              </main>
              <Footer />
            </TeamProvider>
          </LeagueProvider>
        </SessionProvider>

        <Analytics />
      </body>
    </html>
  );
}
