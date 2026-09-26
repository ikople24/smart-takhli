// components/flood-relief/BaseMapToggle.tsx — ปุ่มสลับ แผนที่/ดาวเทียม
// แยกจาก BaseTiles.tsx โดยตั้งใจ: ไฟล์นี้ต้องไม่ import react-leaflet/leaflet เพราะถูก import ตรง ๆ จากคอมโพเนนต์
// ที่ render ฝั่ง server (LocationPicker) — leaflet แตะ window ตอนโหลด ทำ next build ล้ม "window is not defined"

export type BaseMap = "street" | "satellite";

/** ปุ่มสลับ แผนที่/ดาวเทียม — segmented control ขนาดแตะได้บนมือถือ */
export default function BaseMapToggle({
  value,
  onChange,
  className = "",
}: {
  value: BaseMap;
  onChange: (v: BaseMap) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="รูปแบบแผนที่" className={`grid grid-cols-2 gap-1 rounded-[10px] bg-tk-unclaimed-soft p-0.5 ${className}`}>
      {(
        [
          ["street", "แผนที่"],
          ["satellite", "ดาวเทียม"],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`h-7 rounded-lg px-2 text-[11.5px] font-bold ${
            value === k ? "bg-white text-tk-flood shadow-tk-xs" : "text-tk-ink-4"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
