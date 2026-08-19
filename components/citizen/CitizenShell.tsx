// components/citizen/CitizenShell.tsx
// app shell ฝั่งประชาชนโฉมใหม่ — เนื้อหากว้างสุด 480px กึ่งกลางจอ (ตาม spec:
// ไม่ทำ responsive หลายคอลัมน์) พร้อม Nav ล่าง ใช้ได้กับทุกหน้า citizen เฟสถัดไป
// หมายเหตุ: route ที่ใช้ shell นี้ต้องถูกยกเว้นจาก layout เดิมใน components/Layout.js
import { ReactNode } from "react";
import { anuphan } from "./fonts";
import BottomNav from "./BottomNav";
import TopNavbar from "@/components/TopNavbar";

export default function CitizenShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className={`${anuphan.className} min-h-screen bg-[#EDEAF3]`}>
      {/* TopNavbar เดิมทั้งดุ้น (ล็อกอิน Clerk / avatar / กระดิ่ง / ทางลัดแผงควบคุม) — ตามคำขอเจ้าของ */}
      <TopNavbar />
      <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[480px] flex-col bg-[#F6F5FA] text-[#1B1830] shadow-[0_0_40px_rgba(60,40,100,0.10)]">
        <main className="flex-1">{children}</main>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
