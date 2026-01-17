import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; 
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/react';
import { TeamProvider } from "@/context/TeamContext"; // 1. Import the Provider

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GFL League Manager",
  description: "Manage rosters and trades",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <TeamProvider>
          {/* Navbar sits at the top */}
          <Navbar />
          
          {/* Main content area */}
          <main className="min-h-screen">
            {children}
          </main>
          
          {/* Footer sits at the bottom, outside the main min-h-screen area */}
          <Footer />
        </TeamProvider>

        <Analytics />
      </body>
    </html>
  );
}