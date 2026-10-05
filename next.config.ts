import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The whole app is client-side — no server, no database. Exporting to plain
   * HTML means the demo can be handed over as a folder, or dropped on any
   * static host, without anything to run.
   */
  output: "export",
  // Emits `calendar/index.html` instead of `calendar.html`, which is what
  // static hosts expect when the URL has no extension.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
