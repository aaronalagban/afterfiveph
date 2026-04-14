import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['apify-client', 'proxy-agent'],
};

export default nextConfig;

