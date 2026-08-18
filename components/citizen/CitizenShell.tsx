// components/citizen/CitizenShell.tsx
// app shell ฝั่งประชาชนโฉมใหม่ — เนื้อหากว้างสุด 480px กึ่งกลางจอ (ตาม spec:
// ไม่ทำ responsive หลายคอลัมน์) พร้อม Nav ล่าง ใช้ได้กับทุกหน้า citizen เฟสถัดไป
// หมายเหตุ: route ที่ใช้ shell นี้ต้องถูกยกเว้นจาก layout เดิมใน components/Layout.js
import { ReactNode } from "react";
import { anuphan } from "./fonts";
import BottomNav from "./BottomNav";

export default function CitizenShell({ children }: { children: ReactNode }) {
  return (
    <div className={`${anuphan.className} min-h-screen bg-[#EDEAF3]`}>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[#F6F5FA] text-[#1B1830] shadow-[0_0_40px_rgba(60,40,100,0.10)]">
        <main className="flex-1">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
