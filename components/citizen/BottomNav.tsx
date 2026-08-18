// components/citizen/BottomNav.tsx
// Nav ล่างฝั่งประชาชนโฉมใหม่ — เฟสนี้ 2 แท็บ + ปุ่มแจ้งเรื่องกลาง
// (แท็บโปรไฟล์รอระบบระบุตัวตนประชาชน ตาม spec 2026-08-18)
import Link from "next/link";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.9} strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export default function BottomNav({ onReport }: { onReport: () => void }) {
  return (
    <nav className="sticky bottom-0 z-20 flex items-end border-t border-[#EFEDF4] bg-white px-4 pb-6 pt-2">
      <Link href="/preview" className="flex flex-1 flex-col items-center gap-1 text-[#7C3AED]">
        <HomeIcon active />
        <span className="text-[11px] font-semibold">หน้าแรก</span>
      </Link>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onReport}
          aria-label="แจ้งเรื่องร้องเรียน"
          className="-mt-9 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] shadow-[0_10px_22px_rgba(124,58,237,0.4)] transition hover:scale-105"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <Link href="/status" className="flex flex-1 flex-col items-center gap-1 text-[#A7A2B6]">
        <StatusIcon />
        <span className="text-[11px]">สถานะ</span>
      </Link>
    </nav>
  );
}
