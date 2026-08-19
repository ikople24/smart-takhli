// components/citizen/home/HeaderCard.tsx
// การ์ดหัวหน้าแรก + จุดเข้าสู่ระบบ (แทน TopNavbar เดิมที่ไม่ครอบหน้า citizen แล้ว):
// ยังไม่ล็อกอิน = ปุ่มไอคอนคนเปิด Clerk sign-in modal · ล็อกอินแล้ว = UserButton
// · เจ้าหน้าที่ (role admin/superadmin — เงื่อนไขเดียวกับ TopNavbar.js) มีชิป
// "แผงควบคุม" เข้า /admin/dashboard
import Image from "next/image";
import Link from "next/link";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function HeaderCard() {
  const { isSignedIn, user } = useUser();
  const userRole = (user?.publicMetadata?.role as string) || "admin";
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-4 py-4 shadow-[0_12px_26px_rgba(124,58,237,0.28)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
        <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={40} height={40} className="h-10 w-10 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-tight text-white">เทศบาลเมืองตาคลี</div>
        <div className="text-[10px] font-medium tracking-[2px] text-white/75">SMART TAKHLI</div>
      </div>

      {isSignedIn ? (
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1 rounded-full bg-white/18 px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              แผงควบคุม
            </Link>
          )}
          <UserButton afterSignOutUrl="/preview" />
        </div>
      ) : (
        <SignInButton mode="modal">
          <button
            type="button"
            aria-label="เข้าสู่ระบบเจ้าหน้าที่"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/18 text-white transition hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
            </svg>
          </button>
        </SignInButton>
      )}
    </div>
  );
}
