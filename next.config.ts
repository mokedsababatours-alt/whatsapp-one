import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // This creates a minimal production build with only necessary files
  output: "standalone",

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable React strict mode for better development experience
  reactStrictMode: true,
};

export default nextConfig;
