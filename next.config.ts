import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dice tray launcher owns the bottom-left corner; keep the dev-only
  // Next.js indicator out of its way.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
