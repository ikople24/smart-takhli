import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // /preview/* คือ route ทดลองของรีดีไซน์ (ก่อน cutover 2026-08-19) — redirect
  // ไป route จริง กันลิงก์/bookmark ที่แชร์ไว้ช่วงทดสอบตาย
  async redirects() {
    return [
      { source: "/preview", destination: "/", permanent: true },
      { source: "/preview/report", destination: "/report", permanent: true },
      { source: "/preview/status", destination: "/status", permanent: true },
      { source: "/preview/status/:id", destination: "/status/:id", permanent: true },
      { source: "/preview/activities", destination: "/activities", permanent: true },
    ];
  },
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
