// แผงรีเช็คบันทึกโบที่ยังไม่ผูกหัวโบล์ (แท็บทะเบียน → ตัวกรอง "รีเช็คจากงานโบ")
// ให้คนที่รู้พื้นที่ตัดสิน 1 ใน 3: เป็นหัวเดิมในทะเบียน / สร้างหัวใหม่ตรงนี้ / ไม่ใช่หัวโบล์
// ห้ามตัดสินจากชื่อจุดอย่างเดียว — ระยะจาก GPS หน้างานเป็นหลัก (ชื่อซ้ำกันได้ ตำแหน่งในทะเบียนอาจผิด)
import { useMemo, useState } from "react";
import { Ban, Link2, MapPinPlus, X } from "lucide-react";
import { FLUSH_POINT_KIND_COLORS, FLUSH_POINT_KIND_LABELS, nearestFlushPoints } from "@/lib/smart-papar/flushPoints";
import { cloudinaryThumb } from "@/lib/smart-papar/cloudinaryThumb";
import PhotoLightbox from "./PhotoLightbox";

const NEAR_M = 200;

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function FlushPointRecheckPanel({ log, points, busy = false, onLink, onCreate, onDismiss, onClose }) {
  const [photoIndex, setPhotoIndex] = useState(null);
  const [lng, lat] = log.location?.coordinates || [];
  const nearby = useMemo(
    () => nearestFlushPoints(points.filter((p) => p.active !== false), lat, lng, { limit: 3, maxM: NEAR_M }),
    [points, lat, lng]
  );
  const photos = [
    ...(log.photosBefore || []).map((src, i) => ({ src, caption: `รูปก่อนโบ ${i + 1}` })),
    ...(log.photosAfter || []).map((src, i) => ({ src, caption: `รูปหลังโบ ${i + 1}` })),
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-pp-line px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-pp-turbid-ink">จุดโบที่ยังไม่ผูกหัวโบล์</div>
          <h3 className="truncate font-tk-sans text-lg font-bold">{log.locationName}</h3>
          <div className="text-[13px] text-pp-muted">
            โบ {fmtDateTime(log.flushedAt)} · {log.createdByName || "-"}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 flex-none place-items-center rounded-full hover:bg-pp-ground">
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <button key={p.src} type="button" onClick={() => setPhotoIndex(i)} className="flex-none cursor-zoom-in" aria-label={`ดู${p.caption}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cloudinaryThumb(p.src, 320)} alt={p.caption} className="h-24 w-32 rounded-lg object-cover" />
              </button>
            ))}
          </div>
        )}
        {log.note && <p className="rounded-lg bg-pp-ground px-3 py-2 text-sm">{log.note}</p>}

        <div>
          <div className="mb-1.5 text-sm font-semibold">เป็นหัวในทะเบียนนี้ไหม?</div>
          {nearby.length === 0 ? (
            <p className="text-sm text-pp-muted">ไม่มีหัวในทะเบียนภายใน {NEAR_M} ม. — น่าจะเป็นหัวใหม่</p>
          ) : (
            <ul className="space-y-1.5">
              {nearby.map(({ point, distanceM }) => (
                <li key={point._id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLink(point)}
                    className="flex w-full items-center gap-2.5 rounded-xl border-[1.5px] border-pp-line px-3 py-2.5 text-left hover:bg-pp-tint-2 disabled:opacity-50"
                  >
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full"
                      style={{ background: FLUSH_POINT_KIND_COLORS[point.kind] || FLUSH_POINT_KIND_COLORS.unknown }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-tk-mono text-sm">{point.code}</span>
                      <span className="block truncate text-[13px] text-pp-muted">
                        {[point.name || point.roadName, FLUSH_POINT_KIND_LABELS[point.kind]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={`flex-none text-sm tabular-nums ${distanceM > 30 ? "text-pp-turbid-ink" : "text-pp-muted"}`}>
                      {distanceM} ม.
                    </span>
                    <Link2 size={16} className="flex-none text-pp-water" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-pp-muted">
            เลือกแล้วบันทึกโบนี้จะนับเป็นของหัวนั้น (ตำแหน่งหัวไม่เปลี่ยน — ถ้าตำแหน่งทะเบียนผิดให้แก้หัวนั้นต่อ)
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-pp-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={onCreate}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pp-water font-semibold text-white disabled:opacity-50"
        >
          <MapPinPlus size={18} aria-hidden />
          สร้างหัวใหม่ตรงนี้
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="flex h-10 w-full items-center justify-center gap-1.5 text-sm font-semibold text-pp-muted disabled:opacity-50"
        >
          <Ban size={16} aria-hidden />
          ไม่ใช่หัวโบล์ — ไม่ต้องขึ้นรายการอีก
        </button>
      </div>

      <PhotoLightbox images={photos} index={photoIndex} onChange={setPhotoIndex} onClose={() => setPhotoIndex(null)} />
    </div>
  );
}
