// components/flood-relief/admin/ZoneToolbar.tsx — แผงเครื่องมือโซน มุมขวาบนของแผนที่ (เฉพาะ superadmin)
// เลือกระดับก่อน แล้วกดวาด · แก้มุม/ลบ = กดเครื่องมือแล้วคลิกโซนบนแผนที่
import { Check, Circle, Hand, Pentagon, SquarePen, Trash2 } from "lucide-react";
import { ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";

export type ZoneTool = "none" | "polygon" | "circle" | "edit" | "delete";

const TOOLS: Array<{ key: ZoneTool; label: string; Icon: typeof Hand; danger?: boolean }> = [
  { key: "none", label: "เลือก/ลากแผนที่", Icon: Hand },
  { key: "polygon", label: "วาดโซนหลายเหลี่ยม", Icon: Pentagon },
  { key: "circle", label: "วาดโซนวงกลม (มาร์คจุด)", Icon: Circle },
  { key: "edit", label: "แก้ไขจุดมุม", Icon: SquarePen },
  { key: "delete", label: "ลบโซน", Icon: Trash2, danger: true },
];

const HINT: Record<ZoneTool, string> = {
  none: "เลือกระดับสี แล้วกดปุ่มวาด · ระบบนับคำขอในโซนให้อัตโนมัติ",
  polygon: "คลิกวางมุมทีละจุด · ดับเบิลคลิกเพื่อปิดรูป",
  circle: "กดตรงจุดน้ำท่วมค้างไว้ แล้วลากออกเพื่อกำหนดรัศมี",
  edit: "คลิกโซนที่ต้องการแก้ แล้วลากจุดมุม",
  delete: "คลิกโซนที่ต้องการลบ",
};

export default function ZoneToolbar({
  tool,
  setTool,
  level,
  setLevel,
  zoneCount,
  onManage,
}: {
  tool: ZoneTool;
  setTool: (t: ZoneTool) => void;
  level: ZoneLevel;
  setLevel: (l: ZoneLevel) => void;
  zoneCount: number;
  onManage: () => void;
}) {
  return (
    <div className="absolute right-3.5 top-3.5 z-[500] w-[208px] rounded-2xl bg-white/97 p-2.5 shadow-tk-xl">
      <div className="px-0.5 text-[11px] font-bold tracking-[0.5px] text-tk-ink-4">เครื่องมือโซน</div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {TOOLS.map(({ key, label, Icon, danger }) => {
          const on = tool === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={on}
              onClick={() => setTool(on && key !== "none" ? "none" : key)}
              className={`flex h-9 items-center justify-center rounded-[10px] ${
                on ? (danger ? "bg-tk-overdue-ink text-white" : "bg-tk-flood text-white") : danger ? "bg-tk-unclaimed-soft text-tk-overdue-ink" : "bg-tk-unclaimed-soft text-tk-ink-2"
              }`}
            >
              <Icon size={17} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 px-0.5 text-[11px] font-bold text-tk-ink-4">ระดับโซนที่วาด</div>
      <div role="radiogroup" aria-label="ระดับโซนที่วาด" className="mt-1.5 flex flex-col gap-1">
        {ZONE_LEVELS.map((l) => {
          const on = level === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setLevel(l)}
              className={`flex h-8 items-center gap-2 rounded-lg border-[1.5px] px-2 text-[12px] font-semibold ${
                on ? "border-tk-flood bg-tk-flood-soft" : "border-transparent bg-white hover:bg-tk-bg"
              }`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: ZONE_META[l].fill }} />
              <span className="flex-1 text-left">{ZONE_META[l].label}</span>
              {on && <Check size={14} className="text-tk-flood" aria-hidden />}
            </button>
          );
        })}
      </div>

      <p className="mt-2 rounded-[10px] bg-tk-bg p-2 text-[10.5px] leading-[1.45] text-tk-ink-3">{HINT[tool]}</p>
      <button
        type="button"
        onClick={onManage}
        className="mt-2 flex h-[34px] w-full items-center justify-center rounded-[10px] bg-tk-primary-tint text-[12px] font-bold text-tk-primary-darker"
      >
        จัดการโซนทั้งหมด ({zoneCount})
      </button>
    </div>
  );
}
