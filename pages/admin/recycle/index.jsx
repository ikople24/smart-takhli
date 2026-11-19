// โครงการพระสังข์หอบทอง — รับฝากขยะรีไซเคิล (บันทึกน้ำหนักเป็น กก. ตามประเภท)
// แท็บ: รับฝาก | สมาชิก | แลกของ | บัตร QR | สรุป   (เลือกแท็บผ่าน ?tab=)
// เข้าครั้งแรกในแต่ละ session → โชว์ Loading การ์ตูนพระสังข์ ~1.6 วินาที
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import DepositTodayPanel from "@/components/recycle/DepositTodayPanel";
import MembersPanel from "@/components/recycle/MembersPanel";
import MemberCardsPanel from "@/components/recycle/MemberCardsPanel";
import SummaryPanel from "@/components/recycle/SummaryPanel";
import RewardsPanel from "@/components/recycle/RewardsPanel";
import RecycleLoading from "@/components/recycle/RecycleLoading";
import { waitForMascot } from "@/lib/recycle/mascot";
import { DISPLAY, ICON, Icon, RECYCLE_ROOT } from "@/lib/recycle/theme";

const TABS = [
  { id: "deposit", label: "รับฝาก" },
  { id: "members", label: "สมาชิก" },
  { id: "rewards", label: "แลกของ" },
  { id: "cards", label: "บัตร QR" },
  { id: "summary", label: "สรุป" },
];
const INTRO_KEY = "recycle_intro_shown";

export default function RecyclePage() {
  const router = useRouter();
  const tab = TABS.some((t) => t.id === router.query.tab) ? router.query.tab : "deposit";
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      seen = true; // เก็บค่าไม่ได้ → ไม่ต้องโชว์ซ้ำทุกครั้ง
    }
    if (seen) return;
    setIntro(true);
    // ปิด Loading เมื่อครบ 1.6 วิ และภาพการ์ตูนโหลดเสร็จแล้ว (ไม่งั้นเน็ตช้าจะเห็นแต่วงกลมเปล่า)
    let cancelled = false;
    Promise.all([new Promise((r) => setTimeout(r, 1600)), waitForMascot()]).then(() => {
      if (!cancelled) setIntro(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectTab = (id) => {
    router.replace({ pathname: router.pathname, query: { tab: id } }, undefined, { shallow: true });
  };

  return (
    <PermissionGuard>
      {intro && <RecycleLoading fullscreen message="กำลังเข้าสู่ระบบ" />}
      <main className={`${RECYCLE_ROOT} min-h-screen p-4 sm:p-6 print:bg-white print:p-0`}>
        <div className="max-w-5xl mx-auto space-y-4">
          <header className="flex items-center gap-3 print:hidden">
            <div className="w-11 h-11 rounded-[14px] bg-[#146C43] text-white flex items-center justify-center shrink-0">
              <Icon d={ICON.leaf} size={24} />
            </div>
            <div>
              <h1 className={`${DISPLAY} text-xl font-semibold leading-tight`}>พระสังข์หอบทอง</h1>
              <p className="text-xs text-[#51605A]">ธนาคารขยะรีไซเคิล · บันทึกน้ำหนัก (กก.) ตามประเภท ผ่านบัตร QR สมาชิก</p>
            </div>
          </header>

          <div
            role="tablist"
            aria-label="เมนูพระสังข์หอบทอง"
            className="grid grid-cols-5 gap-1 rounded-[18px] bg-white p-1 border border-[#E4E0D4] print:hidden"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={[
                  "h-11 rounded-[14px] text-[13px] sm:text-[15px] font-semibold transition-colors",
                  tab === t.id ? "bg-[#146C43] text-white" : "text-[#51605A] hover:bg-[#F5F3EC]",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "deposit" && <DepositTodayPanel />}
          {tab === "members" && <MembersPanel />}
          {tab === "rewards" && <RewardsPanel />}
          {tab === "cards" && <MemberCardsPanel />}
          {tab === "summary" && <SummaryPanel />}
        </div>
      </main>
    </PermissionGuard>
  );
}
