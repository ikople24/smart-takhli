// รายการงานโบตะกอน (การ์ด) + modal รายละเอียด
import { FLUSHING_RESULT_LABELS } from "@/lib/smart-papar/flushing";

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ResultBadge({ result }) {
  const cls =
    result === "clear" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {result === "clear" ? "✅ " : "⚠️ "}
      {FLUSHING_RESULT_LABELS[result] || "-"}
    </span>
  );
}

export function FlushingList({ logs, onSelect }) {
  if (logs.length === 0) {
    return <div className="py-10 text-center text-slate-500">ยังไม่มีบันทึกโบตะกอนในช่วงนี้</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {logs.map((l) => {
        const thumb = l.photosAfter?.[0] || l.photosBefore?.[0];
        return (
          <button
            key={l._id}
            type="button"
            onClick={() => onSelect(l)}
            className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm hover:border-sky-200"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-20 w-20 flex-none rounded-xl object-cover" />
            ) : (
              <div className="h-20 w-20 flex-none rounded-xl bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate font-semibold text-slate-900">{l.locationName}</div>
                <ResultBadge result={l.result} />
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {fmtDateTime(l.flushedAt)} · {l.durationMin} นาที
              </div>
              <div className="mt-0.5 truncate text-sm text-slate-500">
                โดย {l.createdByName || "-"}
                {l.source === "field" && (
                  <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">ภาคสนาม</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PhotoRow({ title, urls }) {
  if (!urls?.length) return null;
  return (
    <div>
      <div className="mb-1 text-sm font-semibold text-slate-700">{title}</div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-28 w-28 rounded-xl object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function FlushingDetail({ log, canModify, onClose, onEdit, onDelete }) {
  const [lng, lat] = log.location?.coordinates || [];
  const ntu = (v) => (v === null || v === undefined ? "-" : `${v} NTU`);
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto bg-white p-4 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{log.locationName}</h2>
            <div className="text-sm text-slate-600">{fmtDateTime(log.flushedAt)}</div>
          </div>
          <ResultBadge result={log.result} />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">ระยะเวลา</dt>
          <dd>{log.durationMin} นาที</dd>
          <dt className="text-slate-500">ความขุ่นก่อน</dt>
          <dd>{ntu(log.turbidityBeforeNtu)}</dd>
          <dt className="text-slate-500">ความขุ่นหลัง</dt>
          <dd>{ntu(log.turbidityAfterNtu)}</dd>
          <dt className="text-slate-500">ผู้บันทึก</dt>
          <dd>
            {log.createdByName || "-"}
            {log.source === "field" && " (ภาคสนาม)"}
          </dd>
          {lat != null && (
            <>
              <dt className="text-slate-500">พิกัด</dt>
              <dd>
                <a
                  className="text-sky-700 underline"
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดใน Google Maps
                </a>
              </dd>
            </>
          )}
        </dl>
        {log.note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-sm">{log.note}</p>}

        <div className="mt-3 space-y-3">
          <PhotoRow title="รูปก่อนโบ" urls={log.photosBefore} />
          <PhotoRow title="รูปหลังโบ" urls={log.photosAfter} />
        </div>

        <div className="mt-4 flex gap-2">
          {canModify && (
            <>
              <button type="button" onClick={onEdit} className="flex-1 rounded-xl bg-sky-600 py-2.5 font-semibold text-white">
                แก้ไข
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl border border-rose-300 px-4 py-2.5 font-semibold text-rose-700"
              >
                ลบ
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 font-semibold text-slate-700">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
