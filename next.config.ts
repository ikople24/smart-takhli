import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "res.cloudinary.com",
      "storage.googleapis.com",
      "cdn-icons-png.flaticon.com",
    ],
  },
};

export default nextConfig;
