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
  // ภาพประกอบโมดูลพระสังข์หอบทอง (การ์ตูน Loading ~110KB) — ค่าเดิม max-age=0 ทำให้ต้องเช็คกับ
  // เซิร์ฟเวอร์ทุกครั้งที่เปิด Loading → แคชไว้ 7 วัน (เปลี่ยนภาพให้ตั้งชื่อไฟล์ใหม่ ดู lib/recycle/mascot.js)
  async headers() {
    return [
      {
        source: "/recycle/:file([\\w.-]+\\.webp)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
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
