// components/flood-relief/admin/ZoneToolbar.tsx — แผงเครื่องมือโซน มุมขวาบนของแผนที่ (เฉพาะ superadmin)
// เติมสีทั้งชุมชน (เจ้าของสั่ง 2026-09-26 แทนการวาด/วงเอง): เลือกสี → กด "เติมสี" → คลิกชุมชนบนแผนที่
import { Check, Eraser, Hand, PaintBucket } from "lucide-react";
import { ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";

export type ZoneTool = "none" | "fill";
/** สีที่เติม · "clear" = ล้างสีชุมชนออก (ลบโซนของชุมชนนั้น) */
export type FillPaint = ZoneLevel | "clear";

const HINT: Record<ZoneTool, string> = {
  none: "เลือกสี แล้วกด \"เติมสี\" · ระบบนับคำขอในโซนให้อัตโนมัติ",
  fill: "คลิกชุมชนบนแผนที่เพื่อเติมสี · คลิกซ้ำด้วยสีอื่นเพื่อเปลี่ยนระดับ",
};

export default function ZoneToolbar({
  tool,
  setTool,
  paint,
  setPaint,
  zoneCount,
  onManage,
}: {
  tool: ZoneTool;
  setTool: (t: ZoneTool) => void;
  paint: FillPaint;
  setPaint: (p: FillPaint) => void;
  zoneCount: number;
  onManage: () => void;
}) {
  const tools = [
    { key: "none" as const, label: "เลือก/ลากแผนที่", Icon: Hand },
    { key: "fill" as const, label: "เติมสีชุมชน", Icon: PaintBucket },
  ];
  const paints: Array<{ key: FillPaint; label: string; swatch?: string }> = [
    ...ZONE_LEVELS.map((l) => ({ key: l, label: ZONE_META[l].label, swatch: ZONE_META[l].fill })),
    { key: "clear", label: "ล้างสี" },
  ];

  return (
    <div className="absolute right-3.5 top-3.5 z-[500] w-[200px] rounded-2xl bg-white/97 p-2.5 shadow-tk-xl">
      <div className="px-0.5 text-[11px] font-bold tracking-[0.5px] text-tk-ink-4">เครื่องมือโซน</div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {tools.map(({ key, label, Icon }) => {
          const on = tool === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setTool(key)}
              className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[12px] font-bold ${
                on ? "bg-tk-flood text-white" : "bg-tk-unclaimed-soft text-tk-ink-2"
              }`}
            >
              <Icon size={16} aria-hidden />
              {key === "fill" ? "เติมสี" : "เลือก"}
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 px-0.5 text-[11px] font-bold text-tk-ink-4">สีที่เติม</div>
      <div role="radiogroup" aria-label="สีที่เติม" className="mt-1.5 flex flex-col gap-1">
        {paints.map((p) => {
          const on = paint === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPaint(p.key);
                setTool("fill"); // เลือกสีแล้วพร้อมเติมทันที ไม่ต้องกดปุ่มเติมสีซ้ำ
              }}
              className={`flex h-8 items-center gap-2 rounded-lg border-[1.5px] px-2 text-[12px] font-semibold ${
                on ? "border-tk-flood bg-tk-flood-soft" : "border-transparent bg-white hover:bg-tk-bg"
              }`}
            >
              {p.swatch ? (
                <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: p.swatch }} />
              ) : (
                <Eraser size={14} className="shrink-0 text-tk-ink-4" aria-hidden />
              )}
              <span className="flex-1 text-left">{p.label}</span>
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
