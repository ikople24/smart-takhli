// components/elderly-school/ElderlySchoolModule.jsx
// หน้าหลักโรงเรียนผู้สูงอายุแบบแท็บ — เมนูย่อยทั้งหมดอยู่ใน ?tab= ของ /admin/elderly-school
// (ไม่มีหน้า/เมนู sidebar แยก จึงไม่ต้องลงทะเบียนสิทธิ์เพิ่ม — ใช้สิทธิ์ /admin/elderly-school ที่เดียว)
import React, { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { usePermissions } from "@/components/PermissionGuard";
import { currentYearBE } from "@/lib/elderly-school/followUp";
import { inputCls, labelCls } from "./elderlyTheme";
import OverviewTab from "./tabs/OverviewTab";
import VisitsTab from "./tabs/VisitsTab";
import RegistryTab from "./tabs/RegistryTab";
import ScreeningTab from "./tabs/ScreeningTab";
import ScheduleTab from "./tabs/ScheduleTab";
import CardsTab from "./tabs/CardsTab";
import ImportTab from "./tabs/ImportTab";

export const TABS = [
  { key: "overview", label: "ภาพรวม", Component: OverviewTab },
  { key: "visits", label: "การมาเรียน", Component: VisitsTab },
  { key: "registry", label: "ทะเบียนผู้เรียน", Component: RegistryTab },
  { key: "screening", label: "คัดกรอง 2Q", Component: ScreeningTab },
  { divider: true },
  { key: "schedule", label: "ตั้งค่าวันเรียน", Component: ScheduleTab },
  { key: "cards", label: "บัตร QR", Component: CardsTab },
  // เดิมการนำเข้าแสดงเฉพาะ superadmin — คงไว้เหมือนเดิม
  { key: "import", label: "นำเข้าข้อมูล", Component: ImportTab, superadminOnly: true },
];

function firstQuery(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default function ElderlySchoolModule() {
  const router = useRouter();
  const { isSuperAdmin } = usePermissions();
  const thisYear = useMemo(() => currentYearBE(), []);

  const visibleTabs = TABS.filter((t) => t.divider || !t.superadminOnly || isSuperAdmin);
  const tabKey = firstQuery(router.query.tab);
  const active = visibleTabs.find((t) => t.key === tabKey) || visibleTabs[0];

  const yearParam = Number(firstQuery(router.query.yearBE));
  const yearBE = Number.isFinite(yearParam) && yearParam > 2500 ? yearParam : thisYear;
  const yearOptions = [thisYear - 1, thisYear, thisYear + 1];
  if (!yearOptions.includes(yearBE)) yearOptions.push(yearBE);

  /** เปลี่ยนแท็บ/พารามิเตอร์แบบ shallow — query อื่น (person, filter) ล้างเมื่อเปลี่ยนแท็บ */
  const go = useCallback(
    (tab, extra = {}) => {
      const query = { tab };
      if (router.query.yearBE) query.yearBE = router.query.yearBE;
      for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null && v !== "") query[k] = String(v);
      }
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
    },
    [router]
  );

  const setQuery = useCallback(
    (patch) => {
      const query = { ...router.query };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") delete query[k];
        else query[k] = String(v);
      }
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
    },
    [router]
  );

  const ActiveTab = active?.Component;

  return (
    <div className="min-h-screen bg-[#F4F3EE] text-[#1D2421]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-12 flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0E5A55] flex items-center justify-center" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10l9-6 9 6" />
                  <path d="M5 10v9h14v-9" />
                  <path d="M10 19v-5h4v5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-[#5B635F]">จัดการ · กองสวัสดิการสังคม</span>
                <h1 className="m-0 text-xl font-bold leading-snug">โรงเรียนผู้สูงอายุ</h1>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <span className={labelCls}>ปี (พ.ศ.)</span>
              <select
                className={inputCls}
                value={yearBE}
                onChange={(e) => setQuery({ yearBE: e.target.value })}
              >
                {yearOptions.sort().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <nav
            aria-label="เมนูโรงเรียนผู้สูงอายุ"
            className="flex items-stretch gap-0.5 overflow-x-auto border-b border-[#E4E2DA] print:hidden"
          >
            {visibleTabs.map((t, i) =>
              t.divider ? (
                <span key={`d${i}`} aria-hidden="true" className="w-px bg-[#D6D3C8] my-3 mx-2 shrink-0" />
              ) : (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => go(t.key)}
                  aria-current={active?.key === t.key ? "page" : undefined}
                  className={
                    "flex items-center min-h-12 px-3.5 -mb-px border-b-[3px] text-[15px] font-semibold whitespace-nowrap transition-colors " +
                    (active?.key === t.key
                      ? "border-[#0E5A55] text-[#0E5A55]"
                      : "border-transparent text-[#3C4541] hover:text-[#1D2421] hover:bg-[#ECEAE3] rounded-t-lg")
                  }
                >
                  {t.label}
                </button>
              )
            )}
          </nav>
        </div>

        {ActiveTab && (
          <ActiveTab
            key={`${active.key}-${yearBE}`}
            yearBE={yearBE}
            query={router.query}
            go={go}
            setQuery={setQuery}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </div>
    </div>
  );
}
