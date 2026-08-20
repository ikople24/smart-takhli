// components/citizen/BottomNav.tsx
// Nav ล่างฝั่งประชาชนโฉมใหม่ — โครงเดียวกับ nav เดิมของเว็บ (BottomNav.js):
// ซ้าย = อยู่ระหว่างดำเนินการ · กลาง = ปุ่ม Home ม่วง (/) · ขวา =
// ดำเนินการเสร็จสิ้น — สองแท็บข้างชี้ /status พร้อม filter
import Link from "next/link";

function ClockIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

export default function BottomNav() {
  // โปร่งแสง + เบลอพื้นหลังแบบเดียวกับ TopNavbar (bg-base-100/90 backdrop-blur-md)
  // ของเดิมเป็นขาวทึบ เลื่อนแล้วการ์ดขาวไหลมาชนจนแยกขอบ nav ไม่ออก —
  // เงาขอบบนช่วยตัดชั้นให้เห็นว่าเป็นแถบลอย ปุ่ม Home ยังทึบตามเดิม
  return (
    <nav className="sticky bottom-0 z-20 flex items-end border-t border-white/70 bg-white/85 px-2 pb-5 pt-2 shadow-[0_-6px_20px_rgba(60,40,100,0.10)] backdrop-blur-xl">
      <Link href="/status?filter=active" className="flex flex-1 flex-col items-center gap-1 text-[#857F99]">
        <ClockIcon />
        <span className="text-[10.5px] leading-tight">อยู่ระหว่างดำเนินการ</span>
      </Link>
      <Link href="/" aria-label="หน้าแรก" className="flex flex-1 flex-col items-center gap-1">
        <span className="-mt-9 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] shadow-[0_10px_22px_rgba(124,58,237,0.4)] transition hover:scale-105">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.1} strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
          </svg>
        </span>
        <span className="text-[10.5px] font-semibold leading-tight text-[#7C3AED]">หน้าแรก</span>
      </Link>
      <Link href="/status?filter=done" className="flex flex-1 flex-col items-center gap-1 text-[#857F99]">
        <CheckIcon />
        <span className="text-[10.5px] leading-tight">ดำเนินการเสร็จสิ้น</span>
      </Link>
    </nav>
  );
}
