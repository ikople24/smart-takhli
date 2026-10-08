// รายการงานโบตะกอน — การ์ดบนมือถือ / ตารางบนจอกว้าง + แผงรายละเอียด
// สถานะ ใส/ขุ่น ต่างกันทั้งสีและไอคอน (Check / TriangleAlert) ไม่พึ่งสีอย่างเดียว
import { useState } from "react";
import { Check, Clock, ExternalLink, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { EDIT_WINDOW_DAYS, FLUSHING_RESULT_LABELS, ntuChangePct } from "@/lib/smart-papar/flushing";
import PhotoLightbox from "./PhotoLightbox";

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtShort = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const hasNtu = (v) => v !== null && v !== undefined && v !== "";

export function ResultBadge({ result, size = "sm" }) {
  const clear = result === "clear";
  const Icon = clear ? Check : TriangleAlert;
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-full font-semibold ${
        clear ? "bg-pp-clear-tint text-pp-clear-ink" : "bg-pp-turbid-tint text-pp-turbid-ink"
      } ${size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"}`}
    >
      <Icon size={size === "lg" ? 14 : 12} strokeWidth={2.6} aria-hidden />
      {FLUSHING_RESULT_LABELS[result] || "-"}
    </span>
  );
}

function FieldTag() {
  return <span className="rounded-md bg-pp-tint px-1.5 py-0.5 text-xs text-pp-water">ภาคสนาม</span>;
}

// locationName ที่เลือกจากทะเบียนเป็นรูป "ชื่อ (CODE)" (flushPointLabel) — แสดงรหัสไว้หน้าแทน ไม่ซ้ำสองที่
function PointName({ log }) {
  const code = log.flushPointCode;
  const name = code ? String(log.locationName || "").replace(` (${code})`, "").trim() : log.locationName;
  return (
    <>
      {code && <span className="font-tk-mono">{code}</span>}
      {code && name && " · "}
      {name}
    </>
  );
}

function NtuCell({ log }) {
  const b = log.turbidityBeforeNtu;
  const a = log.turbidityAfterNtu;
  if (!hasNtu(b) && !hasNtu(a)) return <span className="text-pp-muted">ไม่ได้วัด</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-pp-turbid-ink">{hasNtu(b) ? b : "-"}</span>
      <span className="text-pp-muted"> → </span>
      <span className={`font-semibold ${log.result === "clear" ? "text-pp-clear-ink" : "text-pp-turbid-ink"}`}>
        {hasNtu(a) ? a : "-"}
      </span>
    </span>
  );
}

export function FlushingList({ logs, onSelect }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl bg-white py-12 text-center text-pp-muted">ยังไม่มีบันทึกโบตะกอนในช่วงนี้</div>
    );
  }
  return (
    <>
      {/* มือถือ: การ์ด */}
      <div className="grid grid-cols-1 gap-2.5 md:hidden">
        {logs.map((l) => {
          const thumb = l.photosAfter?.[0] || l.photosBefore?.[0];
          return (
            <button
              key={l._id}
              type="button"
              onClick={() => onSelect(l)}
              className={`flex gap-3 rounded-2xl p-3 text-left ${
                l.result === "still_turbid" ? "bg-pp-turbid-wash" : "bg-white"
              }`}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-[72px] w-[72px] flex-none rounded-xl object-cover" />
              ) : (
                <div className="h-[72px] w-[72px] flex-none rounded-xl bg-pp-ground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-semibold text-pp-ink">
                    <PointName log={l} />
                  </div>
                  <ResultBadge result={l.result} />
                </div>
                <div className="mt-1 text-[13px] text-pp-muted">
                  {fmtShort(l.flushedAt)} · {l.durationMin} นาที
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-pp-muted">
                  {l.createdByName || "-"}
                  {l.source === "field" && <FieldTag />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* จอกว้าง: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm text-pp-ink">
          <thead>
            <tr className="text-left text-[13px] text-pp-muted">
              {["รูป", "วันเวลา", "จุด / หัวโบล์", "นาที", "NTU ก่อน → หลัง", "ผล", "ผู้บันทึก"].map((h) => (
                <th key={h} className={`border-b border-pp-line px-3 py-2.5 font-medium ${h === "นาที" ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const photos = [l.photosBefore?.[0], l.photosAfter?.[0]].filter(Boolean);
              return (
                <tr
                  key={l._id}
                  onClick={() => onSelect(l)}
                  className={`cursor-pointer border-b border-pp-line/60 hover:bg-pp-tint-2 ${
                    l.result === "still_turbid" ? "bg-pp-turbid-wash" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className="flex gap-1">
                      {photos.length ? (
                        photos.map((u) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={u} src={u} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ))
                      ) : (
                        <span className="h-9 w-9 rounded-lg bg-pp-ground" />
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{fmtShort(l.flushedAt)}</td>
                  <td className="px-3 py-2.5">
                    {/* ปุ่มจริงในเซลล์ให้กด Tab เข้าได้ — แถวคลิกได้ด้วยเมาส์ */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(l);
                      }}
                      className="text-left hover:underline"
                    >
                      <PointName log={l} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.durationMin}</td>
                  <td className="px-3 py-2.5">
                    <NtuCell log={l} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ResultBadge result={l.result} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {l.createdByName || "-"}
                      {l.source === "field" && <FieldTag />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// แตะรูป → เปิดเต็มจอบนหน้าเดิม (PhotoLightbox) เลื่อนดูได้ทั้งรูปก่อนและหลังต่อกัน
function PhotoPair({ before, after }) {
  const [photoIndex, setPhotoIndex] = useState(null);
  if (!before?.length && !after?.length) return null;
  const images = [
    ...(before || []).map((src, i) => ({ src, caption: `รูปก่อนโบ ${i + 1}` })),
    ...(after || []).map((src, i) => ({ src, caption: `รูปหลังโบ ${i + 1}` })),
  ];
  const Col = ({ title, urls, offset }) => (
    <div className="space-y-1.5">
      {urls?.length ? (
        <div className="grid gap-1.5">
          {urls.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setPhotoIndex(offset + i)}
              aria-label={`ดู${title} ${i + 1} เต็มจอ`}
              className="relative block w-full cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`${title} ${i + 1}`} className="h-40 w-full rounded-xl object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-pp-ink/65 px-2 py-0.5 text-xs text-white">
                  {title} · {urls.length} รูป
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid h-40 place-items-center rounded-xl bg-pp-ground text-sm text-pp-muted">ไม่มี{title}</div>
      )}
    </div>
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Col title="รูปก่อน" urls={before} offset={0} />
        <Col title="รูปหลัง" urls={after} offset={before?.length || 0} />
      </div>
      <PhotoLightbox
        images={images}
        index={photoIndex}
        onChange={setPhotoIndex}
        onClose={() => setPhotoIndex(null)}
      />
    </>
  );
}

function NtuBars({ log }) {
  const b = Number(log.turbidityBeforeNtu);
  const a = Number(log.turbidityAfterNtu);
  if (!hasNtu(log.turbidityBeforeNtu) && !hasNtu(log.turbidityAfterNtu)) return null;
  const max = Math.max(hasNtu(log.turbidityBeforeNtu) ? b : 0, hasNtu(log.turbidityAfterNtu) ? a : 0, 1);
  const pct = ntuChangePct(log.turbidityBeforeNtu, log.turbidityAfterNtu);
  const Row = ({ label, v, cls }) => (
    <div className="flex items-center gap-2.5">
      <span className="w-11 text-[13px] text-pp-muted">{label}</span>
      <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-white">
        {hasNtu(v) && (
          <span className={`block h-full rounded-full ${cls}`} style={{ width: `${Math.max(3, (Number(v) / max) * 100)}%` }} />
        )}
      </span>
      <span className="w-12 text-right font-semibold tabular-nums">{hasNtu(v) ? v : "-"}</span>
    </div>
  );
  return (
    <section className="space-y-3 rounded-2xl bg-pp-ground p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold">ความขุ่น (NTU)</h3>
        {pct != null && (
          <span className={`text-[13px] font-semibold ${pct >= 0 ? "text-pp-clear-ink" : "text-pp-turbid-ink"}`}>
            {pct >= 0 ? `ลดลง ${pct}%` : `เพิ่มขึ้น ${Math.abs(pct)}%`}
          </span>
        )}
      </div>
      <Row label="ก่อน" v={log.turbidityBeforeNtu} cls="bg-pp-turbid" />
      <Row label="หลัง" v={log.turbidityAfterNtu} cls={log.result === "clear" ? "bg-pp-clear" : "bg-pp-turbid/70"} />
    </section>
  );
}

// history = บันทึกอื่นของหัวโบล์เดียวกันในช่วงที่โหลดอยู่ (ไม่ยิง API เพิ่ม)
export function FlushingDetail({ log, history = [], canModify, onClose, onEdit, onDelete }) {
  const [lng, lat] = log.location?.coordinates || [];
  const others = history.filter((h) => h._id !== log._id);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-pp-ink/45 sm:items-stretch sm:justify-end"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={log.locationName}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-pp-ink sm:max-h-none sm:max-w-[520px] sm:rounded-none sm:shadow-[-12px_0_32px_rgba(11,34,51,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2.5 border-b border-pp-line px-6 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {log.flushPointCode && (
                <div className="font-tk-mono text-sm text-pp-muted">{log.flushPointCode}</div>
              )}
              <h2 className="font-tk-sans text-2xl font-bold leading-tight">{log.locationName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="-mr-2 grid h-11 w-11 flex-none place-items-center rounded-xl text-pp-muted hover:bg-pp-ground"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ResultBadge result={log.result} size="lg" />
            <span className="text-sm text-pp-muted">
              {fmtDateTime(log.flushedAt)} · {log.durationMin} นาที
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <PhotoPair before={log.photosBefore} after={log.photosAfter} />
          <NtuBars log={log} />

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-3 text-[15px]">
            {others.length > 0 && (
              <>
                <dt className="text-pp-muted">ประวัติจุดนี้</dt>
                <dd>
                  โบ {others.length + 1} ครั้งในช่วงที่เลือก
                  <span className="block text-sm text-pp-muted">
                    ครั้งก่อน {fmtShort(others[0].flushedAt)} · {FLUSHING_RESULT_LABELS[others[0].result]}
                  </span>
                </dd>
              </>
            )}
            <dt className="text-pp-muted">ผู้บันทึก</dt>
            <dd className="flex items-center gap-1.5">
              {log.createdByName || "-"}
              {log.source === "field" && <FieldTag />}
            </dd>
            {lat != null && (
              <>
                <dt className="text-pp-muted">พิกัด</dt>
                <dd>
                  <span className="block font-tk-mono text-sm">
                    {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  </span>
                  <a
                    className="inline-flex items-center gap-1 font-semibold text-pp-water"
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    เปิดใน Google Maps <ExternalLink size={14} aria-hidden />
                  </a>
                </dd>
              </>
            )}
          </dl>

          {log.note && (
            <div className="rounded-xl bg-pp-ground px-3.5 py-3 text-sm leading-relaxed">
              <span className="mb-0.5 block font-semibold">หมายเหตุ</span>
              <span className="whitespace-pre-wrap">{log.note}</span>
            </div>
          )}
        </div>

        <div className="space-y-2.5 border-t border-pp-line px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          {canModify && (
            <p className="flex items-center gap-1.5 text-[13px] text-pp-muted">
              <Clock size={16} aria-hidden />
              เจ้าของแก้ไขได้ภายใน {EDIT_WINDOW_DAYS} วันหลังบันทึก
            </p>
          )}
          <div className="flex gap-2.5">
            {canModify ? (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-pp-water font-semibold text-white"
                >
                  <Pencil size={18} aria-hidden />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-pp-danger/40 px-4 font-semibold text-pp-danger"
                >
                  <Trash2 size={18} aria-hidden />
                  ลบ
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-xl border-[1.5px] border-pp-line-2 font-semibold text-pp-ink"
              >
                ปิด
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
