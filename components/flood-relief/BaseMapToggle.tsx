// components/flood-relief/BaseMapToggle.tsx — ปุ่มสลับ แผนที่/ดาวเทียม
// แยกจาก BaseTiles.tsx โดยตั้งใจ: ไฟล์นี้ต้องไม่ import react-leaflet/leaflet เพราะถูก import ตรง ๆ จากคอมโพเนนต์
// ที่ render ฝั่ง server (LocationPicker) — leaflet แตะ window ตอนโหลด ทำ next build ล้ม "window is not defined"

export type BaseMap = "street" | "satellite";

/**
 * ซูมละเอียดของแผนที่ในโมดูล (เจ้าของขอ 2026-09-26) — ส่งเข้า <MapContainer {...FINE_ZOOM}>
 * zoomSnap 0.25 = หยุดได้ทุก ¼ ระดับ · zoomDelta 0.5 = ปุ่ม +/− ครั้งละ ½ ระดับ
 * wheelPxPerZoomLevel 120 = ล้อเมาส์ช้าลงครึ่งหนึ่งจากค่าเริ่มต้น 60
 */
export const FINE_ZOOM = Object.freeze({ zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 120 });

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
