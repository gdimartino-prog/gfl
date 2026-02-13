import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverSourceMaps: false,
  },
};

export default nextConfig;



