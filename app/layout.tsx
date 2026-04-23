import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Luma uses Inter
import "./globals.css";
import { cn } from "@/lib/utils";

// Optimize the Inter font for the Luma preset
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Single Metadata export
export const metadata: Metadata = {
  title: "Poker Tracker",
  description: "Track chips and settle debts at your home games.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Poker Tracker",
  },
};

// Viewport settings are crucial for PWAs to feel like apps
export const viewport: Viewport = {
  themeColor: "#09090b", 
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents accidental zooming on inputs
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning> 
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}