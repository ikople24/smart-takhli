// สรุปทะเบียนหัวโบล์ (คอลัมน์ซ้ายของแผนที่บนเดสก์ท็อป / แถบบนแผนที่บนมือถือ)
// นับจากข้อมูลที่แผนที่โหลดมาแล้ว ไม่ยิง API เพิ่ม
import { FLUSH_POINT_KIND_LABELS } from "@/lib/smart-papar/flushPoints";

const STALE_DAYS = 30;
const KIND_ORDER = ["tee_large", "garland", "tee_medium", "tee_small", "unknown"];

export function summarizeFlushPoints(points, now = Date.now()) {
  const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  let flushed = 0;
  let stale = 0;
  for (const p of points) {
    byKind[p.kind in byKind ? p.kind : "unknown"] += 1;
    if (p.lastFlushedAt) {
      flushed += 1;
      if (now - new Date(p.lastFlushedAt).getTime() > STALE_DAYS * 86400000) stale += 1;
    }
  }
  return { total: points.length, byKind, flushed, never: points.length - flushed, stale };
}

export default function FlushPointSummary({ points, kindColors }) {
  const s = summarizeFlushPoints(points);
  const pct = (n) => (s.total ? Math.round((n / s.total) * 100) : 0);

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div>
        <div className="text-sm text-slate-500">หัวโบล์ในทะเบียน</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tabular-nums text-slate-900">{s.total}</span>
          <span className="text-sm text-slate-500">หัว</span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-semibold text-slate-700">สถานะการโบ</div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${pct(s.flushed)}%` }} />
        </div>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              เคยโบ (มีบันทึก)
            </dt>
            <dd className="font-semibold tabular-nums">{s.flushed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              ยังไม่เคยโบ
            </dt>
            <dd className="font-semibold tabular-nums">{s.never}</dd>
          </div>
          {s.stale > 0 && (
            <div className="flex justify-between text-amber-700">
              <dt>ไม่ได้โบเกิน {STALE_DAYS} วัน</dt>
              <dd className="font-semibold tabular-nums">{s.stale}</dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-semibold text-slate-700">แยกตามชนิด</div>
        <ul className="space-y-1.5">
          {KIND_ORDER.filter((k) => s.byKind[k] > 0).map((k) => (
            <li key={k}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: kindColors[k] }} />
                  {FLUSH_POINT_KIND_LABELS[k]}
                </span>
                <span className="font-semibold tabular-nums">{s.byKind[k]}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct(s.byKind[k])}%`, background: kindColors[k] }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
