import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of another project; keep Next.js from treating the parent as the root.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pptxgenjs", "postgres"],
};

export default nextConfig;
