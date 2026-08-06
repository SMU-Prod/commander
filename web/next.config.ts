import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
