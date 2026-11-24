import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Sans_3 } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source" });

export const metadata: Metadata = {
  title: "D&D character sheet",
  description:
    "A D&D 5e character sheet migrated 1 to 1 from the classic single-file sheet to Next.js, shadcn/ui and Neon.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (Grammarly, Immersive Translate, …) inject attributes
    // on <html>/<body> before hydration; ignore those attribute mismatches only.
    <html lang="en" className={cn("dark font-sans", sans.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
