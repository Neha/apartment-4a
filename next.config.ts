import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@cursor/sdk"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
