// components/flood-relief/admin/KpiBar.tsx — KPI 5 ช่อง (ตัวเลขคำนวณฝั่ง server ใน lib/flood-relief/kpi.ts)
import type { FloodKpi } from "./types";

function Tile({ n, sub, title, cls, numCls }: { n: React.ReactNode; title: string; sub: string; cls: string; numCls: string }) {
  return (
    <div className={`flex min-h-[46px] min-w-[150px] shrink-0 snap-start items-center gap-2.5 rounded-[14px] px-3 lg:min-h-[52px] lg:min-w-0 lg:gap-3 lg:px-3.5 ${cls}`}>
      <span className={`text-[22px] font-bold leading-none tabular-nums lg:text-[26px] ${numCls}`}>{n}</span>
      <span className="whitespace-nowrap text-[11.5px] leading-[1.3] lg:whitespace-normal lg:text-[12px]">
        <b>{title}</b>
        <br />
        {sub}
      </span>
    </div>
  );
}

export default function KpiBar({ kpi }: { kpi: FloodKpi | null }) {
  const k = kpi ?? { criticalPending: 0, newUnassigned: 0, inProgress: 0, doneToday: 0, avgMinutesToSite: null, teamsBusy: 0, teamsTotal: 0 };
  return (
    // มือถือ: แถวเดียวเลื่อนแนวนอน (เดิม 3 แถวกินที่แผนที่) · เดสก์ท็อป: 5 ช่องเต็มแถว
    <div className="flex shrink-0 snap-x gap-2 overflow-x-auto border-b border-tk-line bg-white px-3 py-2 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible lg:px-5 lg:py-3">
      <Tile n={k.criticalPending} title="ด่วนมากค้างอยู่" sub="รอทีมเข้าช่วย" cls="bg-tk-overdue-soft text-tk-overdue-ink-2" numCls="text-tk-overdue-ink" />
      <Tile n={k.newUnassigned} title="คำขอใหม่" sub="ยังไม่มอบหมาย" cls="bg-tk-flood-soft text-tk-flood-dark" numCls="text-tk-flood" />
      <Tile n={k.inProgress} title="กำลังช่วยเหลือ" sub="ทีมออกเดินทาง/ถึงจุด" cls="bg-tk-due-soft text-tk-due-ink" numCls="text-tk-due-ink" />
      <Tile
        n={k.doneToday}
        title="เสร็จสิ้นวันนี้"
        sub={k.avgMinutesToSite != null ? `เฉลี่ยถึงจุด ${k.avgMinutesToSite} นาที` : "ยังไม่มีข้อมูลเวลาถึงจุด"}
        cls="bg-tk-done-soft text-tk-done-ink"
        numCls="text-tk-done-ink"
      />
      <Tile
        n={
          <>
            {k.teamsBusy}
            <span className="text-[14px] text-tk-ink-4">/{k.teamsTotal}</span>
          </>
        }
        title="ทีมออกปฏิบัติงาน"
        sub={k.teamsTotal ? `ว่าง ${k.teamsTotal - k.teamsBusy} ทีม` : "ยังไม่ได้ตั้งทีม"}
        cls="bg-tk-unclaimed-soft text-tk-ink-3"
        numCls="text-tk-ink-2"
      />
    </div>
  );
}
