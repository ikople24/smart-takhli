import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/types/garbage";
import { formatRange, formatThaiTime, minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { KIND_LABEL_TH, truckLabel, weekdayName, zoneLabel } from "@/lib/garbage/labels";
import { findNextPickup } from "@/lib/garbage/nextPickup";
import { useDebounce } from "./useDebounce";

const MIN_CHARS = 2;

/** จัดกลุ่มผลลัพธ์ตามวัน โดยคงลำดับที่ API ส่งมา (เรียงวันแล้วเรียงเวลาแล้ว) */
function groupByWeekday(hits: SearchHit[]): Array<{ weekday: number; weekdayName: string; hits: SearchHit[] }> {
  const groups: Array<{ weekday: number; weekdayName: string; hits: SearchHit[] }> = [];
  for (const h of hits) {
    const last = groups[groups.length - 1];
    if (last && last.weekday === h.weekday) last.hits.push(h);
    else groups.push({ weekday: h.weekday, weekdayName: h.weekdayName, hits: [h] });
  }
  return groups;
}

function timeText(h: SearchHit): string {
  if (h.atMin != null) return `รถถึงประมาณ ${formatThaiTime(h.atMin)}`;
  const range = formatRange(h.startMin, h.endMin);
  return range ? `ช่วง ${range}` : "ยังไม่ระบุเวลา";
}

/** "วันนี้ 9.00 น." · "พรุ่งนี้ 4.00 น." · "วันพุธ 4.00 น. (อีก 2 วัน)" */
function nextPickupText(hits: SearchHit[]): string | null {
  // เดิมกรองเฉพาะ matchType "stop" เพราะผลแบบชุมชนเป็นระดับ "ช่วงเวลา" ที่ไม่มี atMin
  // ตั้งแต่ M8 ผลแบบชุมชนเป็นระดับจุดและมีเวลาจริงเหมือนกัน จึงนับรวมได้
  // ถ้ายังกรองอยู่ คนที่ค้นชื่อชุมชนล้วน (เช่น "ตาคลีใหญ่" ที่ไม่มีจุดชื่อนี้เลย) จะไม่เห็นรอบเก็บถัดไป
  if (hits.length === 0) return null;
  const next = findNextPickup(
    hits.map((h) => ({ weekday: h.weekday, atMin: h.atMin })),
    weekdayOf(todayInBangkok()),
    minutesNowInBangkok()
  );
  if (next == null) return null;
  const when =
    next.daysAhead === 0 ? "วันนี้" : next.daysAhead === 1 ? "พรุ่งนี้" : `วัน${weekdayName(next.weekday)}`;
  const time = next.atMin == null ? "ยังไม่ระบุเวลา" : formatThaiTime(next.atMin);
  const tail = next.daysAhead >= 2 ? ` (อีก ${next.daysAhead} วัน)` : "";
  return `${when} ${time}${tail}`;
}

export default function GarbageSearchPanel() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term.trim(), 300);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      setHits(null);
      setError("");
      setLoading(false);
      return;
    }
    const myId = ++reqIdRef.current;
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: debounced });
        const res = await fetch(`/api/garbage/search?${params}`);
        const json = await res.json();
        if (!alive || myId !== reqIdRef.current) return;
        // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
        if (!res.ok) throw new Error(json?.error || "ค้นหาไม่สำเร็จ");
        setHits(json.hits ?? []);
      } catch (e: unknown) {
        if (!alive || myId !== reqIdRef.current) return;
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
        setHits(null);
      } finally {
        if (alive && myId === reqIdRef.current) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [debounced]);

  const groups = hits ? groupByWeekday(hits) : [];
  // คำนวณครั้งเดียวต่อ render — ใช้ทั้งเงื่อนไขแสดงผลและตัวข้อความ
  const nextText = hits ? nextPickupText(hits) : null;

  return (
    <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
      <h2 className="text-base font-semibold text-slate-800">ค้นหาถนนหรือชุมชนของคุณ</h2>
      <p className="text-xs text-slate-500 mt-0.5">พิมพ์ชื่อถนน ซอย หรือชุมชน เช่น มาลัย · ใส่คำนำหน้าหรือไม่ก็ได้</p>

      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="เช่น มาลัย, ชุมชนสามัคคี"
        // text-base (16px) จำเป็น — ต่ำกว่านี้ iOS Safari จะซูมหน้าเองตอนโฟกัสช่องกรอก
        className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base
          focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        aria-label="ค้นหาถนนหรือชุมชน"
      />

      {term.trim().length > 0 && term.trim().length < MIN_CHARS && (
        <p className="mt-2 text-xs text-slate-500">พิมพ์อีก {MIN_CHARS - term.trim().length} ตัวอักษรเพื่อเริ่มค้นหา</p>
      )}

      {/* live region — ผลค้นหาเปลี่ยนแบบ async คนใช้ screen reader ต้องได้ยินว่าเจอ/ไม่เจอ/กำลังค้น */}
      <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <p role="status" className="mt-3 text-sm text-slate-500">
            กำลังค้นหา...
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 p-4">
            <p className="font-semibold text-amber-900 text-sm">ค้นหาไม่ได้</p>
            <p className="text-xs text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && hits != null && hits.length === 0 && (
          <p role="status" className="mt-3 text-sm text-slate-600">
            ไม่พบ &ldquo;{debounced}&rdquo; — ลองพิมพ์ชื่อถนนหรือชุมชนให้สั้นลง เช่น ตัดคำว่า ซอย ออก
          </p>
        )}

        {!loading && !error && groups.length > 0 && nextText && (
          <div className="mt-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
            <div className="text-xs text-emerald-800">รอบเก็บถัดไปของจุดที่ค้นเจอ</div>
            <div className="text-base font-semibold text-emerald-900">{nextText}</div>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <div key={g.weekday}>
                <div className="text-sm font-semibold text-emerald-800">วัน{g.weekdayName}</div>
                <ul className="mt-1.5 space-y-1.5">
                  {g.hits.map((h, i) => (
                    <li key={`${h.routeCode}-${h.matchName}-${i}`}
                      className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {h.matchType === "community" ? `ชุมชน${h.matchName}` : h.matchName}
                        </span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{truckLabel(h.truckNumber)}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{timeText(h)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {/* ผลแบบชุมชน: หัวรายการเป็นชื่อชุมชนแล้ว บรรทัดนี้จึงบอก "จุดไหนในชุมชน"
                            ผลแบบชื่อจุด: หัวรายการเป็นชื่อจุดแล้ว บรรทัดนี้จึงบอกว่าอยู่ชุมชนไหน */}
                        {h.matchType === "community"
                          ? `${h.stopName} · `
                          : h.communityName
                            ? `ชุมชน${h.communityName} · `
                            : ""}
                        {h.routeName}
                        {KIND_LABEL_TH[h.kind] && (
                          <span className="ml-1.5 inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                            {KIND_LABEL_TH[h.kind]}
                            {/* "แทน" + "โซน 5" = "แทนโซน 5" — ชาวบ้านไม่เคยเห็นรหัสสาย */}
                            {zoneLabel(h.coverForRouteCode)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
