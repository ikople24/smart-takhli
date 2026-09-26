// components/flood-relief/admin/RequestList.tsx — คอลัมน์ซ้าย: ค้นหา · ชิปกรอง · การ์ดคำขอ (กรองในเครื่อง ไม่ยิง API ใหม่)
// ลำดับมาจาก server แล้ว (ด่วนมากก่อนเสมอ → ล่าสุด) — ที่นี่แค่กรอง ไม่เรียงใหม่
import { useMemo } from "react";
import { Search } from "lucide-react";
import { REQUEST_TYPE_META, STATUS_META, isRequestType, isStatus, URGENCY_META, type Urgency } from "@/lib/flood-relief/status";
import { normalizePhone } from "@/lib/flood-relief/phone";
import { useFloodReliefStore, type FloodFilter } from "@/stores/useFloodReliefStore";
import { TypeIcon } from "../icons";
import { hhmm, URGENCY_BADGE, URGENCY_TILE, ZONE_BADGE } from "./labels";
import type { AdminRequest } from "./types";

const FILTERS: Array<{ key: FloodFilter; label: string }> = [
  { key: "all", label: "ทั้งหมด" },
  { key: "critical", label: "ด่วนมาก" },
  { key: "evac", label: REQUEST_TYPE_META.evac.shortLabel },
  { key: "drain", label: REQUEST_TYPE_META.drain.shortLabel },
  { key: "sand", label: REQUEST_TYPE_META.sand.shortLabel },
  { key: "other", label: REQUEST_TYPE_META.other.shortLabel },
];

function matchFilter(r: AdminRequest, f: FloodFilter) {
  if (f === "all") return true;
  if (f === "critical") return r.urgency === "critical";
  return r.type === f;
}

export function useVisibleRequests(items: AdminRequest[]) {
  const { filter, query } = useFloodReliefStore();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = normalizePhone(q);
    return items.filter((r) => {
      if (!matchFilter(r, filter)) return false;
      if (!q) return true;
      if (r.ticket.toLowerCase().includes(q)) return true;
      if (qDigits.length >= 3 && r.phone.includes(qDigits)) return true;
      return [r.communityName, r.landmark, r.reporterName, r.zoneName].some((v) => v && v.toLowerCase().includes(q));
    });
  }, [items, filter, query]);
}

export default function RequestList({ items }: { items: AdminRequest[] }) {
  const { filter, setFilter, query, setQuery, selectedId, select } = useFloodReliefStore();
  const visible = useVisibleRequests(items);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="px-3.5 pt-3">
        <label htmlFor="flood-q" className="sr-only">
          ค้นหาคำขอ
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tk-ink-5" aria-hidden />
          <input
            id="flood-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="เลขที่ / เบอร์โทร / ชุมชน / ซอย"
            className="h-10 w-full rounded-xl border border-tk-line bg-tk-bg pl-9 pr-3 text-[13px] focus:border-tk-flood focus:outline-none"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const count = items.filter((r) => matchFilter(r, f.key)).length;
            const critical = f.key === "critical";
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.key)}
                className={`h-7 rounded-full px-2.5 text-[12px] font-semibold ${
                  on
                    ? critical
                      ? "bg-tk-overdue-ink text-white"
                      : "bg-tk-flood text-white"
                    : critical
                      ? "bg-tk-overdue-soft text-tk-overdue-ink"
                      : "bg-tk-unclaimed-soft text-tk-ink-3"
                }`}
              >
                {f.label} <span className="opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-tk-ink-4">
          <span>
            แสดง <b className="text-tk-ink-strong">{visible.length}</b> รายการ
          </span>
          <span>
            เรียงตาม <span className="font-semibold text-tk-flood">ความเร่งด่วน · ล่าสุด</span>
          </span>
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-tk-line">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-tk-ink-4">ยังไม่มีคำขอในตัวกรองนี้</p>
        ) : (
          visible.map((r) => {
            const on = r.id === selectedId;
            const statusMeta = isStatus(r.status) ? STATUS_META[r.status] : null;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r.id)}
                aria-current={on}
                className={`flex w-full items-start gap-2.5 border-b border-tk-line-light border-l-[3px] px-3.5 py-3 text-left ${
                  on ? "border-l-tk-flood bg-tk-flood-soft" : "border-l-transparent hover:bg-tk-bg"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${URGENCY_TILE[r.urgency] ?? URGENCY_TILE.normal}`}>
                  <TypeIcon type={r.type} size={22} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="flex items-center gap-1.5">
                    <span className="font-tk-mono text-[11px] text-tk-ink-4">{r.ticket}</span>
                    <span className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${URGENCY_BADGE[r.urgency] ?? ""}`}>
                      {URGENCY_META[r.urgency as Urgency]?.label ?? r.urgency}
                    </span>
                    {r.isOverdue && <span className="text-[10.5px] font-bold text-tk-overdue-ink">เลยเวลา</span>}
                    <span className="ml-auto text-[11px] tabular-nums text-tk-ink-6">{hhmm(r.createdAt)}</span>
                  </span>
                  <span className="text-[13.5px] font-bold leading-[1.25]">
                    {isRequestType(r.type) ? REQUEST_TYPE_META[r.type].label : r.type}
                  </span>
                  <span className="truncate text-[11.5px] leading-[1.3] text-tk-ink-3">
                    {[r.landmark, r.communityName ? `ชุมชน${r.communityName}` : null].filter(Boolean).join(" · ") || "ไม่มีจุดสังเกต"}
                  </span>
                  <span className="mt-px flex items-center gap-1.5">
                    {r.zoneLabel && (
                      <span className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${ZONE_BADGE[r.zoneLevel ?? ""] ?? ZONE_BADGE.safe}`}>
                        {r.zoneLabel}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold" style={{ color: statusMeta?.ink }}>
                      {statusMeta?.label ?? r.status}
                    </span>
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
