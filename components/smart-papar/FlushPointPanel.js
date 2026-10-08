// แผงข้อมูลหัวโบล์ — แสดงทับขอบขวาของแผนที่ (มือถือ: แผ่นล่าง) เมื่อคลิกหมุดหัวโบล์
// อยู่นอก <MapContainer> โดยตั้งใจ: ไม่ถูกหมุดทับ และคลิก/เลื่อนในแผงไม่ไปลากแผนที่
import { FLUSH_POINT_KIND_LABELS } from "@/lib/smart-papar/flushPoints";
import { cloudinaryThumb } from "@/lib/smart-papar/cloudinaryThumb";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-20 flex-none text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-900">{children || "-"}</dd>
    </div>
  );
}

export default function FlushPointPanel({ point, color, onClose }) {
  if (!point) return null;
  const [lng, lat] = point.location?.coordinates || [];
  const surveyed = point.legacy?.surveyedAt
    ? `${fmtDate(point.legacy.surveyedAt)}${point.legacy.surveyedBy ? ` · ${point.legacy.surveyedBy}` : ""}`
    : "";

  return (
    <aside
      className="absolute inset-x-2 bottom-2 z-[1000] flex max-h-[75%] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:inset-x-auto sm:bottom-2 sm:right-2 sm:top-2 sm:max-h-none sm:w-80"
      aria-label={`ข้อมูลหัวโบล์ ${point.code}`}
    >
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            หัวโบล์ · {FLUSH_POINT_KIND_LABELS[point.kind] || "ไม่ระบุชนิด"}
          </div>
          <h3 className="mt-0.5 truncate text-lg font-bold text-slate-900">{point.code}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="-mr-1 grid h-8 w-8 flex-none place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {point.photoUrl && (
          <a href={point.photoUrl} target="_blank" rel="noreferrer" className="block bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryThumb(point.photoUrl, 640)}
              alt={`รูปหัวโบล์ ${point.code}`}
              className="aspect-[4/3] w-full object-cover"
            />
          </a>
        )}

        <div className="px-4 pt-3">
          {point.lastFlushedAt ? (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <div className="font-semibold">โบล่าสุด {fmtDate(point.lastFlushedAt)}</div>
              <div className="text-emerald-700">บันทึกในระบบ {point.flushCount} ครั้ง</div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              ยังไม่มีบันทึกโบในระบบ
            </div>
          )}
        </div>

        <dl className="divide-y px-4 pb-2">
          <Row label="ชื่อจุด">{point.name}</Row>
          <Row label="ถนน/ซอย">{point.roadName}</Row>
          <Row label="สำรวจเมื่อ">{surveyed}</Row>
        </dl>
      </div>

      {lat != null && (
        <footer className="border-t px-4 py-3">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl bg-sky-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-sky-700"
          >
            นำทางไปหัวนี้
          </a>
        </footer>
      )}
    </aside>
  );
}
