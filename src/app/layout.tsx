import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Shell } from "@/components/navigation/Shell";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import "./globals.css";

const source = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "PlayOware",
  description: "Play Oware. Learn the board, finish the game, and review what happened.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${source.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SettingsProvider>
          <Shell>{children}</Shell>
        </SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
