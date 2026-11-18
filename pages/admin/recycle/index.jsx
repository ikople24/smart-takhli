// โครงการพระสังข์หอบทอง — รับฝากขยะรีไซเคิล (บันทึกน้ำหนักเป็น กก. ตามประเภท)
// แท็บ: รับฝาก | สมาชิก | บัตร QR | สรุป   (เลือกแท็บผ่าน ?tab=)
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import DepositTodayPanel from "@/components/recycle/DepositTodayPanel";
import MembersPanel from "@/components/recycle/MembersPanel";
import MemberCardsPanel from "@/components/recycle/MemberCardsPanel";
import SummaryPanel from "@/components/recycle/SummaryPanel";

const TABS = [
  { id: "deposit", label: "รับฝาก" },
  { id: "members", label: "สมาชิก" },
  { id: "cards", label: "บัตร QR" },
  { id: "summary", label: "สรุป" },
];

export default function RecyclePage() {
  const router = useRouter();
  const tab = TABS.some((t) => t.id === router.query.tab) ? router.query.tab : "deposit";

  const selectTab = (id) => {
    router.replace({ pathname: router.pathname, query: { tab: id } }, undefined, { shallow: true });
  };

  return (
    <PermissionGuard>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6 print:bg-white print:p-0">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 print:hidden">
            <p className="text-lg font-semibold text-gray-900">พระสังข์หอบทอง</p>
            <p className="text-xs text-gray-500 mt-1">รับฝากขยะรีไซเคิล — บันทึกน้ำหนัก (กก.) ตามประเภท ผ่านบัตร QR สมาชิก</p>
          </div>

          <div role="tablist" aria-label="เมนูพระสังข์หอบทอง" className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 ring-1 ring-gray-200/70 shadow-sm print:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={[
                  "h-12 rounded-xl text-sm sm:text-base font-semibold transition-colors",
                  tab === t.id ? "bg-emerald-700 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "deposit" && <DepositTodayPanel />}
          {tab === "members" && <MembersPanel />}
          {tab === "cards" && <MemberCardsPanel />}
          {tab === "summary" && <SummaryPanel />}
        </div>
      </main>
    </PermissionGuard>
  );
}
