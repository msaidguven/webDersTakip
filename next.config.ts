import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async redirects() {
    return [
      {
        source: "/5-sinif/fen-bilimleri/isigin-dunyasi/fb-5-4-3-tam-golgenin-olusumu",
        destination: "/5-sinif/fen-bilimleri/isigin-dunyasi/tam-golgenin-olusumu",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
