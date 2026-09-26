// components/flood-relief/admin/KpiBar.tsx — KPI 5 ช่อง (ตัวเลขคำนวณฝั่ง server ใน lib/flood-relief/kpi.ts)
import type { FloodKpi } from "./types";

function Tile({ n, sub, title, cls, numCls }: { n: React.ReactNode; title: string; sub: string; cls: string; numCls: string }) {
  return (
    <div className={`flex min-h-[52px] items-center gap-3 rounded-[14px] px-3.5 ${cls}`}>
      <span className={`text-[26px] font-bold leading-none tabular-nums ${numCls}`}>{n}</span>
      <span className="text-[12px] leading-[1.3]">
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
    <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-tk-line bg-white px-5 py-3 md:grid-cols-3 xl:grid-cols-5">
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
