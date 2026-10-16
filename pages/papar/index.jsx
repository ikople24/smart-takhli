// หน้าสรุปคุณภาพน้ำประปาสำหรับประชาชน — กดจากการ์ด "น้ำประปา" บนหน้าแรก (ไม่ต้องล็อกอิน)
// แสดงเฉพาะน้ำประปาจ่ายออก (tap) · ข้อมูลจาก /api/smart-papar/water-quality/public-summary (ตัวเลขรวมเท่านั้น)
// ใช้ CitizenShell — /papar ต้องอยู่ในรายการ citizen route ของ components/Layout.js (exact, ไม่รวม /papar/flushing)
// ดีไซน์ 2026-10-16: คำตอบก่อน (วันนี้ผ่านเกณฑ์ไหม) → ตัวเลข → กราฟ 30 วัน → งานโบตะกอน → แจ้งน้ำขุ่น (/papar/report)
// สีระดับความขุ่นใช้ waterLevel/ntuShade เท่านั้น — ห้ามตั้งเกณฑ์สีชุดใหม่ในหน้านี้
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Droplet, ShowerHead, TriangleAlert } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import { ntuShade, waterLevel } from "@/lib/citizen/waterLevel";
import { WATER_STANDARDS, phWithin, tdsWithin, ntuWithin } from "@/lib/smart-papar/publicSummary";
import { bangkokYmd } from "@/lib/smart-papar/flushing";

const fmtDate = (ymd, opts = { day: "numeric", month: "short", year: "2-digit" }) =>
  ymd ? new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts }) : "-";
const fmtNum = (v, digits) => (v === null || v === undefined ? "–" : Number(v).toFixed(digits));

const card = "rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]";
const CHART_MAX_NTU = 8; // แท่งที่เกินนี้ถูกตัดที่ยอด (ยังเห็นว่าเกินเส้นเกณฑ์ชัด)
const CHART_H = 112;

// ตำแหน่งหมุดบนแถบระดับความขุ่น — ช่วงกว้างไม่เท่ากันตามเกณฑ์ waterLevel (0–5 · 5–15 · 15–20 · 20+)
function gaugePct(ntu) {
  const v = Number(ntu);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v <= 5) return (v / 5) * 25;
  if (v <= 15) return 25 + ((v - 5) / 10) * 40;
  if (v <= 20) return 65 + ((v - 15) / 5) * 15;
  return 80 + Math.min((v - 20) / 20, 1) * 20;
}

function Glass({ tint, stroke }) {
  return (
    <svg width="76" height="96" viewBox="0 0 76 96" aria-hidden="true" className="block flex-none">
      <path d="M8 6 H68 L60 90 H16 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12.5 34 C 24 28, 36 40, 48 34 S 64 30, 64.4 34 L59 86 H17 Z" fill={tint} fillOpacity="0.6" />
      <path d="M22 44 Q 26 40 30 44" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function RangeTile({ title, value, unit, ok, rangeText, explain, band, markerPct }) {
  const good = ok !== false;
  return (
    <section aria-label={title} className={`${card} flex flex-col gap-2`}>
      <span className="text-[13px] font-semibold text-[#6B6880]">{title}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[30px] font-bold leading-none tabular-nums">{value}</span>
        {unit && <span className="text-xs text-[#6B6880]">{unit}</span>}
      </span>
      <div className="relative h-2 rounded-full bg-[#F1F0F5]">
        <span
          className={`absolute inset-y-0 block ${good ? "bg-[#BBF7D0]" : "bg-[#FECACA]"}`}
          style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%`, borderRadius: 6 }}
        />
        {markerPct !== null && (
          <span
            className={`absolute -top-1 block h-4 w-1 -translate-x-1/2 rounded ${good ? "bg-[#15803D]" : "bg-[#B91C1C]"}`}
            style={{ left: `${Math.max(0, Math.min(100, markerPct))}%` }}
          />
        )}
      </div>
      {ok === null ? (
        <span className="text-xs text-[#6B6880]">ไม่มีข้อมูล</span>
      ) : (
        <span className={`text-xs font-semibold ${good ? "text-[#15803D]" : "text-[#B91C1C]"}`}>
          {good ? "✓ " : "! เกิน · "}
          {rangeText}
        </span>
      )}
      <span className="text-xs leading-relaxed text-[#6B6880]">{explain}</span>
    </section>
  );
}

export default function PaparPublicPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [picked, setPicked] = useState(null); // index ในกราฟ (เก่า→ใหม่) · null = วันล่าสุด

  useEffect(() => {
    let alive = true;
    fetch("/api/smart-papar/water-quality/public-summary")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.success) {
          setData(d.data);
          setState("ready");
        } else setState("error");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, []);

  const latest = data?.latest;
  const level = waterLevel(latest?.ntu);
  const checks = [ntuWithin(latest?.ntu), phWithin(latest?.ph), tdsWithin(latest?.tds)];
  const known = checks.filter((c) => c !== null);
  const failing = known.filter((c) => c === false).length;
  const allOk = known.length > 0 && failing === 0;

  const days = useMemo(() => (data?.daily ? [...data.daily].reverse() : []), [data]); // เก่า → ใหม่
  const sel = days.length ? days[picked ?? days.length - 1] : null;
  const passDays = (data?.daily || []).filter((r) => r.status === "ok").length;
  const measuredDays = (data?.daily || []).filter((r) => r.status !== "none").length;

  // งานโบตะกอน 7 วันล่าสุด (ปฏิทินไทย) — รวมจากรายวันที่ API ส่งมา ไม่ต้องยิง API เพิ่ม
  const flushing = data?.flushing || [];
  const weekStart = bangkokYmd(new Date(Date.now() - 6 * 86400000));
  const week = flushing.filter((d) => d.date >= weekStart);
  const weekTotal = week.reduce((s, d) => s + d.total, 0);
  const weekClear = week.reduce((s, d) => s + d.clear, 0);
  const weekPct = weekTotal ? Math.round((weekClear / weekTotal) * 100) : 0;

  const hero = allOk
    ? { bg: "#E6F1FE", ink: "#1E3A8A", sub: "#1E40AF", glass: "#93C5FD", stroke: "#2563EB" }
    : { bg: "#FEF6E0", ink: "#7C2D12", sub: "#92400E", glass: "#D9A55B", stroke: "#B45309" };

  return (
    <>
      <Head>
        <title>คุณภาพน้ำประปา | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ค่าความขุ่น pH และ TDS ของน้ำประปาเทศบาลเมืองตาคลี ย้อนหลัง 30 วัน และผลงานโบตะกอน" />
      </Head>
      <CitizenShell>
        <div className="space-y-3.5 px-4 pb-8 pt-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#7C3AED] shadow-sm"
          >
            <ChevronLeft size={15} strokeWidth={2.4} aria-hidden />
            กลับหน้าแรก
          </Link>

          <div>
            <h1 className="text-[26px] font-bold leading-tight">น้ำประปาวันนี้</h1>
            <p className="text-sm text-[#6B6880]">ผลตรวจน้ำที่จ่ายออกจากโรงกรองประปาเทศบาลเมืองตาคลี</p>
          </div>

          {state === "loading" && <div className={`${card} py-10 text-center text-sm text-[#6B6880]`}>กำลังโหลด…</div>}
          {state === "error" && (
            <div className={`${card} py-10 text-center text-sm text-[#B91C1C]`}>โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</div>
          )}

          {state === "ready" && (
            <>
              {/* 1. คำตอบก่อน + ความขุ่น */}
              <section aria-label="สรุปผลตรวจล่าสุด" className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(60,40,100,0.06)]">
                <div className="flex items-center gap-4 px-[18px] pb-[18px] pt-5" style={{ background: hero.bg }}>
                  <Glass tint={hero.glass} stroke={hero.stroke} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    {known.length > 0 && (
                      <span
                        className="inline-flex self-start items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold"
                        style={{ color: allOk ? "#15803D" : "#B45309" }}
                      >
                        {allOk ? <Check size={14} strokeWidth={3} aria-hidden /> : <TriangleAlert size={14} strokeWidth={2.6} aria-hidden />}
                        {allOk ? `ผ่านเกณฑ์ครบ ${known.length} ค่า` : `เกินเกณฑ์ ${failing} ค่า`}
                      </span>
                    )}
                    <span className="text-xl font-bold leading-snug" style={{ color: hero.ink }}>
                      {known.length === 0
                        ? "ยังไม่มีผลตรวจล่าสุด"
                        : allOk
                        ? "น้ำใส ใช้อุปโภคบริโภคได้ตามเกณฑ์กรมอนามัย"
                        : ntuWithin(latest?.ntu) === false
                        ? `วันนี้น้ำขุ่นกว่าปกติ อยู่ระดับ${level.label}`
                        : "วันนี้มีค่าเกินเกณฑ์ กองการประปากำลังตรวจสอบ"}
                    </span>
                    <span className="text-[13px]" style={{ color: hero.sub }}>
                      ตรวจล่าสุด {fmtDate(latest?.recordDate, { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-[18px]">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#6B6880]">ความขุ่น</div>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className="text-[44px] font-bold leading-none tabular-nums"
                          style={{ color: level.key === "none" ? "#6B6880" : level.chipText }}
                        >
                          {fmtNum(latest?.ntu, 2)}
                        </span>
                        <span className="text-sm text-[#6B6880]">NTU</span>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
                      style={{ background: level.chipBg, color: level.chipText }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.dot }} />
                      {level.label}
                    </span>
                  </div>
                  {level.key !== "none" && (
                    <div className="space-y-1.5" aria-hidden="true">
                      <div className="relative flex h-3 gap-[3px]">
                        <span className="block flex-[25] rounded-l-md bg-[#BFDBFE]" />
                        <span className="block flex-[40] bg-[#FDE7B0]" />
                        <span className="block flex-[15] bg-[#FBCDB4]" />
                        <span className="block flex-[20] rounded-r-md bg-[#F9C2C7]" />
                        <span
                          className="absolute -top-[5px] block h-[22px] w-[22px] -translate-x-1/2 rounded-full border-4 border-white shadow"
                          style={{ left: `${gaugePct(latest?.ntu)}%`, background: level.chipText }}
                        />
                      </div>
                      <div className="relative h-4 text-[11px] text-[#6B6880]">
                        <span className="absolute left-0">0</span>
                        <span className="absolute left-[25%] -translate-x-1/2 font-semibold text-[#1B1830]">
                          {WATER_STANDARDS.ntuMax} · เกณฑ์
                        </span>
                        <span className="absolute left-[65%] -translate-x-1/2">15</span>
                        <span className="absolute left-[80%] -translate-x-1/2">20</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[13px] leading-relaxed text-[#6B6880]">
                    ยิ่งตัวเลขน้อยน้ำยิ่งใส กรมอนามัยกำหนดไม่เกิน {WATER_STANDARDS.ntuMax} NTU วัดที่หน้าโรงกรองประปา
                    น้ำที่บ้านอาจต่างได้ตามสภาพท่อ
                  </p>
                </div>
              </section>

              {/* 2. pH + TDS */}
              <div className="grid grid-cols-2 gap-3">
                <RangeTile
                  title="pH กรด–ด่าง"
                  value={fmtNum(latest?.ph, 2)}
                  ok={phWithin(latest?.ph)}
                  rangeText={`ในเกณฑ์ ${WATER_STANDARDS.phMin}–${WATER_STANDARDS.phMax}`}
                  explain="7 คือเป็นกลาง น้ำดื่มควรเป็นกลางหรือด่างอ่อน"
                  band={[(WATER_STANDARDS.phMin / 14) * 100, (WATER_STANDARDS.phMax / 14) * 100]}
                  markerPct={latest?.ph == null ? null : (Number(latest.ph) / 14) * 100}
                />
                <RangeTile
                  title="TDS สารละลาย"
                  value={fmtNum(latest?.tds, 0)}
                  unit="mg/L"
                  ok={tdsWithin(latest?.tds)}
                  rangeText={`ไม่เกิน ${WATER_STANDARDS.tdsMax}`}
                  explain="แร่ธาตุในน้ำไม่เกิน 600 mg/L ถือว่าใช้อุปโภคบริโภคได้ตามเกณฑ์"
                  band={[0, 100]}
                  markerPct={latest?.tds == null ? null : (Number(latest.tds) / WATER_STANDARDS.tdsMax) * 100}
                />
              </div>

              {/* 3. กราฟ 30 วัน */}
              <section aria-label="ความขุ่นย้อนหลัง" className={`${card} space-y-3`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[17px] font-bold">ย้อนหลัง {days.length} วัน</h2>
                  {measuredDays > 0 && (
                    <span className={`text-[13px] font-semibold ${passDays === measuredDays ? "text-[#15803D]" : "text-[#B45309]"}`}>
                      ผ่านเกณฑ์ {passDays}/{measuredDays} วัน
                    </span>
                  )}
                </div>
                {days.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#6B6880]">ยังไม่มีข้อมูล</p>
                ) : (
                  <>
                    <div className="relative flex items-end gap-[3px] border-b border-[#ECEAF2] pt-2" style={{ height: CHART_H + 8 }}>
                      <span
                        className="pointer-events-none absolute inset-x-0 block border-t-[1.5px] border-dashed border-[#6B6880]"
                        style={{ bottom: (WATER_STANDARDS.ntuMax / CHART_MAX_NTU) * CHART_H }}
                      />
                      <span
                        className="pointer-events-none absolute right-0 bg-white pl-1 text-[11px] text-[#6B6880]"
                        style={{ bottom: (WATER_STANDARDS.ntuMax / CHART_MAX_NTU) * CHART_H + 3 }}
                      >
                        เกณฑ์ {WATER_STANDARDS.ntuMax}
                      </span>
                      {days.map((d, i) => {
                        const on = i === (picked ?? days.length - 1);
                        const shade = ntuShade(d.ntu);
                        const h = d.ntu === null ? 3 : Math.max(4, Math.round((Math.min(d.ntu, CHART_MAX_NTU) / CHART_MAX_NTU) * CHART_H));
                        const bg = d.ntu === null ? "#ECEAF2" : shade.key === "ok" ? shade.bg : waterLevel(d.ntu).dot;
                        return (
                          <button
                            key={d.recordDate}
                            type="button"
                            aria-label={`${fmtDate(d.recordDate)} ความขุ่น ${fmtNum(d.ntu, 2)} NTU`}
                            aria-pressed={on}
                            onClick={() => setPicked(i)}
                            className="min-w-0 flex-1 rounded-t"
                            style={{ height: h, background: bg, outline: on ? "2px solid #1B1830" : "none", outlineOffset: 1 }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[11px] text-[#6B6880]">
                      <span>{fmtDate(days[0].recordDate, { day: "numeric", month: "short" })}</span>
                      <span>แตะแท่งเพื่อดูรายวัน</span>
                      <span>{fmtDate(days[days.length - 1].recordDate, { day: "numeric", month: "short" })}</span>
                    </div>
                    {sel && (
                      <div className="flex items-center gap-3 rounded-2xl bg-[#F6F5FA] px-3.5 py-3" aria-live="polite">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{fmtDate(sel.recordDate, { day: "numeric", month: "long", year: "2-digit" })}</div>
                          <div className="text-[13px] text-[#6B6880]">
                            ขุ่น <b className="text-[#1B1830]">{fmtNum(sel.ntu, 2)}</b> · pH <b className="text-[#1B1830]">{fmtNum(sel.ph, 2)}</b> · TDS{" "}
                            <b className="text-[#1B1830]">{fmtNum(sel.tds, 0)}</b>
                          </div>
                        </div>
                        {sel.status !== "none" && (
                          <span
                            className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
                              sel.status === "ok" ? "bg-[#E6F6EE] text-[#15803D]" : "bg-[#FEF6E0] text-[#B45309]"
                            }`}
                          >
                            {sel.status === "ok" ? "✓ ผ่านเกณฑ์" : "เกินเกณฑ์"}
                          </span>
                        )}
                      </div>
                    )}
                    {/* ตารางรายวันแสดงตลอด สูงพอดี ~5 แถว เลื่อนดูวันก่อนหน้าในกล่อง (เจ้าของขอ 2026-10-16) */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">ตารางรายวัน</span>
                      {data.daily.length > 5 && <span className="text-xs text-[#9590A8]">เลื่อนดูวันก่อนหน้า</span>}
                    </div>
                    <div className="max-h-[236px] overflow-y-auto overscroll-contain rounded-xl ring-1 ring-[#F1F0F5]">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="sticky top-0 z-10 bg-white text-left text-xs text-[#6B6880]">
                            <th className="py-1.5 pl-3 font-semibold">วันที่</th>
                            <th className="py-1.5 text-right font-semibold">NTU</th>
                            <th className="py-1.5 text-right font-semibold">pH</th>
                            <th className="py-1.5 pr-3 text-right font-semibold">TDS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.daily.map((r) => (
                            <tr key={r.recordDate} className="border-t border-[#F1F0F5]">
                              <td className="py-2 pl-3">{fmtDate(r.recordDate)}</td>
                              <td className="py-2 text-right">
                                {r.ntu === null ? (
                                  "–"
                                ) : (
                                  <span
                                    className="inline-block min-w-[3.25rem] rounded-full px-2 py-0.5 text-center font-semibold tabular-nums"
                                    style={(({ bg, text }) => ({ background: bg, color: text }))(ntuShade(r.ntu))}
                                  >
                                    {fmtNum(r.ntu, 2)}
                                  </span>
                                )}
                              </td>
                              <td className={`py-2 text-right tabular-nums ${phWithin(r.ph) === false ? "font-semibold text-[#B91C1C]" : ""}`}>
                                {fmtNum(r.ph, 2)}
                              </td>
                              <td className={`py-2 pr-3 text-right tabular-nums ${tdsWithin(r.tds) === false ? "font-semibold text-[#B91C1C]" : ""}`}>
                                {fmtNum(r.tds, 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              {/* 4. งานโบตะกอน */}
              <section aria-label="งานโบตะกอน" className={`${card} space-y-3.5`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-[#E6F1FE] text-[#2563EB]">
                    <ShowerHead size={22} aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-bold">งานโบตะกอน</h2>
                    <p className="text-[13px] leading-relaxed text-[#6B6880]">
                      เจ้าหน้าที่เปิดหัวโบล์ระบายตะกอนในท่อ เมื่อมีจุดที่น้ำขุ่น
                    </p>
                  </div>
                </div>
                {weekTotal === 0 ? (
                  <p className="py-4 text-center text-sm text-[#6B6880]">ไม่มีงานโบตะกอนใน 7 วันล่าสุด</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div
                        className="grid h-[84px] w-[84px] flex-none place-items-center rounded-full"
                        style={{ background: `conic-gradient(#2563EB 0 ${weekPct}%, #E6F1FE ${weekPct}% 100%)` }}
                        role="img"
                        aria-label={`ใสแล้ว ${weekPct}%`}
                      >
                        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white">
                          <span className="text-xl font-bold leading-none text-[#2563EB]">{weekPct}%</span>
                          <span className="text-[10px] text-[#6B6880]">ใสแล้ว</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[13px] text-[#6B6880]">7 วันล่าสุด</div>
                        <div className="text-[15px] leading-normal">
                          โบ <b>{weekTotal} จุด</b> · ใสแล้ว <b className="text-[#2563EB]">{weekClear} จุด</b>
                        </div>
                      </div>
                    </div>
                    <div>
                      {week.slice(0, 3).map((d) => (
                        <div key={d.date} className="flex items-center gap-2.5 border-t border-[#F1F0F5] py-2.5 text-[13px]">
                          <span className="w-16">{fmtDate(d.date, { day: "numeric", month: "short" })}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6F1FE]">
                            <span className="block h-full bg-[#3B82F6]" style={{ width: `${d.clearPct}%` }} />
                          </span>
                          <span className="w-[90px] text-right text-[#6B6880]">
                            <b className="text-[#1B1830]">
                              {d.clear}/{d.total}
                            </b>{" "}
                            จุด
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {/* 5. แจ้งน้ำขุ่น/ไม่ไหล */}
          <Link
            href="/papar/report"
            className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-[#FDE7B0] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]"
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-[#FEF6E0] text-[#B45309]">
              <Droplet size={22} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold">น้ำที่บ้านขุ่น หรือไม่ไหล?</span>
              <span className="block text-[13px] text-[#6B6880]">แจ้งเรื่อง พร้อมปักหมุดบ้าน เจ้าหน้าที่จะไปตรวจ</span>
            </span>
            <ChevronRight size={20} className="text-[#6B6880]" aria-hidden />
          </Link>

          {/* 6. ปุ่มโบตะกอน (หน้าเจ้าหน้าที่) — คงแบบเดิมตามที่เจ้าของขอ */}
          <Link
            href="/papar/flushing"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#08465A] text-[15px] font-semibold text-white shadow-sm"
          >
            โบตะกอน
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
          </Link>
          <p className="text-center text-[11px] text-[#6B6880]">สำหรับเจ้าหน้าที่บันทึกงานโบตะกอน</p>
        </div>
      </CitizenShell>
    </>
  );
}
