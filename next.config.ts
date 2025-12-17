import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "res.cloudinary.com",
      "storage.googleapis.com",
      "cdn-icons-png.flaticon.com",
      "images.clerk.dev",
      "storage.googleapis.com",
      "ppim.pea.co.th",
    ],
  },
};

export default nextConfig;
