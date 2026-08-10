import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['primereact', 'primeicons'],
  reactStrictMode: true,
  images: {
    domains: [],
  },
};

export default nextConfig;