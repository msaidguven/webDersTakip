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
      {
        source: "/default.aspx",
        destination: "/",
        permanent: true,
      },
      {
        source: "/Default.aspx",
        destination: "/",
        permanent: true,
      },
      {
        source: "/about.html",
        destination: "/hakkimizda",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/hakkimizda",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
