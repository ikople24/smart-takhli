import { PIPE_MATERIALS, NODE_TYPES, CODE_COLORS } from "@/lib/smart-water/constants";

export const NODE_STYLE = {
  hydrant: { color: "#DC2626", fill: true },
  gate_valve: { color: "#16A34A", fill: false },
  tap: { color: "#374151", fill: true },
  end_cap: { color: "#6B7280", fill: false },
  water_meter: { color: "#2563EB", fill: false },
  blow_off: { color: "#EA580C", fill: true },
};

export default function PipeLegend() {
  return (
    <div className="absolute bottom-6 right-4 z-[1000] rounded-lg bg-white/95 p-3 text-xs shadow-lg ring-1 ring-black/10 max-h-[60vh] overflow-y-auto">
      {/* สีผูกกับรหัส (ขนาด) ตามแบบร่าง 2568 — ไม่ใช่ตามชนิดวัสดุ */}
      <div className="mb-1 font-semibold text-slate-700">รหัสท่อ (สีตามแบบ)</div>
      {Object.entries(CODE_COLORS).map(([code, color]) => (
        <div key={code} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-1 w-6 rounded"
            style={{ backgroundColor: color }}
          />
          <span className="text-slate-600">{code}</span>
        </div>
      ))}
      <div className="mt-1 text-[10px] leading-4 text-slate-400">
        {Object.entries(PIPE_MATERIALS)
          .map(([letter, m]) => `${letter} = ${m.nameTh}`)
          .join(" · ")}
        <br />รหัสอื่นนอกแบบแสดงเป็นสีเทา
      </div>
      <div className="mt-2 mb-1 font-semibold text-slate-700">อุปกรณ์</div>
      {Object.entries(NODE_TYPES).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-3 w-3 rounded-full border-2"
            style={{
              borderColor: NODE_STYLE[k]?.color ?? "#000",
              backgroundColor: NODE_STYLE[k]?.fill
                ? NODE_STYLE[k].color
                : "transparent",
            }}
          />
          <span className="text-slate-600">{v.nameTh}</span>
        </div>
      ))}
    </div>
  );
}
