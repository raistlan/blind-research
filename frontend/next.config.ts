import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    RILLA_API_KEY: process.env.RILLA_API_KEY,
  },
};

export default nextConfig;
