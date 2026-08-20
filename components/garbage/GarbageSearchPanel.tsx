import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/types/garbage";
import { formatRange, formatThaiTime, minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { KIND_LABEL_TH, truckLabel, weekdayName, zoneLabel } from "@/lib/garbage/labels";
import { findNextPickup } from "@/lib/garbage/nextPickup";
import { buildDayChips, pickDefaultWeekday } from "@/lib/garbage/searchDays";
import type { TrackedStop } from "@/lib/garbage/trackedStop";
import { useDebounce } from "./useDebounce";
import { useLocateCommunity } from "./useLocateCommunity";

const MIN_CHARS = 2;

/** hit หนึ่งแถว → รูปจุดที่ติดตาม (zoneLabel มาจาก routeCode ไม่ต้องให้ API ส่งมา) */
function toTrackedStop(h: SearchHit): TrackedStop {
  return {
    routeCode: h.routeCode,
    seq: h.seq,
    stopName: h.stopName,
    zoneLabel: zoneLabel(h.routeCode),
    truckNumber: h.truckNumber,
    truckColor: h.truckColor,
    atMin: h.atMin,
    // วันของ hit ไม่ใช่วันนี้ — จุดเดียวกันคนละวันรถถึงคนละเวลา นับถอยหลังจึงต้องผูกกับวันที่เลือก
    weekday: h.weekday as TrackedStop["weekday"],
  };
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

export default function GarbageSearchPanel({
  tracked,
  onToggleTracked,
}: {
  tracked: TrackedStop | null;
  onToggleTracked: (next: TrackedStop) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term.trim(), 300);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // ชุมชนที่ได้จากปุ่ม "รถขยะใกล้ฉัน" — ใช้ติดป้ายว่าผลชุดนี้มาจากตำแหน่ง ไม่ใช่คำที่พิมพ์เอง
  const [locatedCommunity, setLocatedCommunity] = useState<string | null>(null);
  // วันที่กำลังดูอยู่ในแถบชิป — null = ยังไม่มีผลค้นหา
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const reqIdRef = useRef(0);
  const { state: locateState, message: locateMessage, locate, clearMessage } = useLocateCommunity();

  // เติมชื่อชุมชนลงช่องค้นหาแทนที่จะค้นเงียบ ๆ — ผู้ใช้เห็นว่าระบบเดาชุมชนไหนให้
  // และแก้คำเองต่อได้ทันทีถ้าเดาผิด (ช่องค้นหาเดิมยิง API ให้อยู่แล้ว)
  const locateMe = () => {
    locate((community) => {
      setLocatedCommunity(community);
      setTerm(community);
    });
  };

  const onTypeTerm = (value: string) => {
    setTerm(value);
    // พิมพ์เองเมื่อไร ผลก็ไม่ใช่ "จากตำแหน่ง" อีกต่อไป
    setLocatedCommunity(null);
    clearMessage();
  };

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
        const nextHits: SearchHit[] = json.hits ?? [];
        setHits(nextHits);
        // ผลชุดใหม่ = วันที่เลือกไว้เดิมอาจไม่มีเก็บแล้ว — เด้งไปวันของรอบถัดไปเสมอ
        setSelectedWeekday(
          pickDefaultWeekday(nextHits, weekdayOf(todayInBangkok()), minutesNowInBangkok())
        );
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

  // คำนวณครั้งเดียวต่อ render — ใช้ทั้งเงื่อนไขแสดงผลและตัวข้อความ
  const nextText = hits ? nextPickupText(hits) : null;
  const dayChips = hits ? buildDayChips(hits) : [];
  const dayHits = hits && selectedWeekday != null ? hits.filter((h) => h.weekday === selectedWeekday) : [];
  // ผลชุดนี้มาจากตำแหน่งจริงก็ต่อเมื่อคำที่ค้นอยู่ยังเป็นชื่อชุมชนที่ระบบหาให้
  // (ผู้ใช้แก้คำเมื่อไร locatedCommunity ถูกล้างอยู่แล้ว — เช็คซ้ำกันสถานะค้างระหว่าง debounce)
  const fromLocation = locatedCommunity != null && debounced === locatedCommunity;

  return (
    <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800">ค้นหาถนนหรือชุมชนของคุณ</h2>
          <p className="text-xs text-slate-500 mt-0.5">พิมพ์ชื่อถนน ซอย หรือชุมชน เช่น มาลัย · ใส่คำนำหน้าหรือไม่ก็ได้</p>
        </div>
        <button
          type="button"
          onClick={locateMe}
          disabled={locateState === "locating"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5
            text-[11.5px] font-semibold text-emerald-800 ring-1 ring-emerald-200
            transition hover:bg-emerald-100 disabled:opacity-60"
        >
          {locateState === "locating" ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
          {locateState === "locating" ? "กำลังหาตำแหน่ง…" : "รถขยะใกล้ฉัน"}
        </button>
      </div>

      {locateMessage && <p className="mt-2 text-xs font-medium text-amber-700">{locateMessage}</p>}

      <input
        type="search"
        value={term}
        onChange={(e) => onTypeTerm(e.target.value)}
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

        {!loading && !error && !fromLocation && hits != null && hits.length === 0 && (
          <p role="status" className="mt-3 text-sm text-slate-600">
            ไม่พบ &ldquo;{debounced}&rdquo; — ลองพิมพ์ชื่อถนนหรือชุมชนให้สั้นลง เช่น ตัดคำว่า ซอย ออก
          </p>
        )}

        {!loading && !error && hits != null && hits.length > 0 && nextText && (
          <div className="mt-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
            <div className="text-xs text-emerald-800">
              {fromLocation ? `รอบเก็บถัดไปในชุมชน${locatedCommunity}` : "รอบเก็บถัดไปของจุดที่ค้นเจอ"}
            </div>
            <div className="text-base font-semibold text-emerald-900">{nextText}</div>
            {fromLocation && (
              <div className="mt-0.5 text-[11px] text-emerald-700">
                จากตำแหน่งของคุณ · แก้คำในช่องค้นหาได้ถ้าไม่ใช่ชุมชนนี้
              </div>
            )}
          </div>
        )}

        {/* อยู่ในเขตชุมชนจริงแต่ไม่มีจุดเก็บที่ค้นเจอ — ต้องบอกให้ต่างจาก "พิมพ์ผิด"
            ไม่งั้นคนอ่านว่า "ไม่พบ <ชื่อชุมชนตัวเอง>" แล้วงงว่าพิมพ์อะไรผิด */}
        {!loading && !error && fromLocation && hits != null && hits.length === 0 && (
          <div className="mt-3 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">ชุมชนของคุณคือ {locatedCommunity}</p>
            <p className="mt-1 text-xs text-amber-800">
              แต่ยังไม่มีจุดเก็บของชุมชนนี้ในระบบ — ลองพิมพ์ชื่อถนนของคุณ หรือสอบถามกองสาธารณสุขตามเบอร์ด้านล่าง
            </p>
          </div>
        )}

        {/* แถบชิป 7 วัน — ค้นชุมชนหนึ่งได้ถึง 90 แถว (19 จุด × 7 วัน) ถ้าไล่ทุกวันพร้อมกันจะล้นจอ
            จึงให้เลือกดูทีละวัน โดยเปิดที่วันของ "รอบเก็บถัดไป" ให้ก่อน */}
        {!loading && !error && hits != null && hits.length > 0 && (
          <div className="mt-4">
            <div className="flex gap-1.5" role="group" aria-label="เลือกวันที่ต้องการดู">
              {dayChips.map((c) => {
                const isSelected = c.weekday === selectedWeekday;
                const isToday = c.weekday === weekdayOf(todayInBangkok());
                return (
                  <button
                    key={c.weekday}
                    type="button"
                    disabled={c.count === 0}
                    onClick={() => setSelectedWeekday(c.weekday)}
                    aria-pressed={isSelected}
                    aria-label={`วัน${weekdayName(c.weekday)}${c.count === 0 ? " ไม่มีรถเข้า" : ` ${c.count} จุด`}`}
                    className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold transition ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : c.count === 0
                          ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    {c.shortName}
                    {/* จุดใต้ตัวอักษรบอกว่าวันนี้คือวันไหน — ผู้ใช้จะได้อ้างอิงตัวเองได้ทันที */}
                    <span
                      aria-hidden="true"
                      className={`mx-auto mt-1 block h-1 w-1 rounded-full ${
                        isToday ? (isSelected ? "bg-white" : "bg-emerald-500") : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-emerald-800">
                วัน{weekdayName(selectedWeekday ?? 0)}
                {selectedWeekday === weekdayOf(todayInBangkok()) && (
                  <span className="ml-1.5 text-[11px] font-medium text-emerald-600">(วันนี้)</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">{dayHits.length} จุด</div>
            </div>

            {/* ชวนให้กด — ไม่งั้นไม่มีใครรู้ว่าแถวพวกนี้แตะได้ (ของเดิมเป็นลิสต์อ่านอย่างเดียว) */}
            <p className="mt-1 text-[11px] text-slate-500">
              📌 แตะจุดของคุณเพื่อติดตาม แล้วหน้าแรกจะนับถอยหลังบอกว่าอีกกี่นาทีรถถึง
            </p>

            <div className="mt-1.5">
                <ul className="space-y-1.5">
                  {dayHits.map((h, i) => {
                    const isTracked =
                      tracked != null && tracked.routeCode === h.routeCode && tracked.seq === h.seq;
                    // `/search` ตั้ง s-maxage=300 — ช่วงหลัง deploy ยังมีผลจากแคชรุ่นก่อนที่ไม่มี
                    // seq/truckColor กดติดตามไปก็เขียนค่าที่ parseTrackedStop อ่านกลับไม่ได้
                    // แล้วจุดหายเงียบ ๆ · แถวแบบนั้นให้แสดงเฉย ๆ ไม่ต้องกด
                    const canTrack = Number.isInteger(h.seq) && Boolean(h.truckColor);
                    return (
                    <li key={`${h.routeCode}-${h.seq}-${h.matchName}-${i}`}>
                      <button
                        type="button"
                        disabled={!canTrack}
                        onClick={() => onToggleTracked(toTrackedStop(h))}
                        aria-pressed={isTracked}
                        className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                          isTracked
                            ? "bg-emerald-50 ring-2 ring-emerald-500"
                            : canTrack
                              ? "bg-slate-50 ring-1 ring-slate-200 hover:ring-emerald-300"
                              : "bg-slate-50 ring-1 ring-slate-200 cursor-default"
                        }`}
                      >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {isTracked && <span aria-hidden="true">📌 </span>}
                          {h.matchType === "community" ? `ชุมชน${h.matchName}` : h.matchName}
                        </span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{truckLabel(h.truckNumber)}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {timeText(h)}
                        {isTracked && (
                          <span className="ml-1.5 font-semibold text-emerald-700">· กำลังติดตาม (แตะเพื่อเลิก)</span>
                        )}
                      </div>
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
                      </button>
                    </li>
                    );
                  })}
                </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
