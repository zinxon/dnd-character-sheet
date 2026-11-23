import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "D&D character sheet — Next.js version",
  description:
    "A D&D 5e character sheet migrated 1 to 1 to Next.js, React and the Vercel UI SDK.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
