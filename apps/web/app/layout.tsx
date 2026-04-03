import type { Metadata } from "next";
import { DM_Mono, Syne } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppFrame } from "@/components/shell/AppFrame";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
});

const syne = Syne({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "TwinNet AI — Digital Twin Agents on 0G",
  description: "Human-verified agents, 0G Compute & Storage, iNFT, ENS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} ${syne.variable}`}>
      <body className={`${dmMono.className} bg-void font-mono text-primary antialiased`}>
        <AppProviders>
          <AppFrame>{children}</AppFrame>
        </AppProviders>
      </body>
    </html>
  );
}
