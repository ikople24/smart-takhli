// หน้าสรุปคุณภาพน้ำประปาสำหรับประชาชน — กดจากการ์ด "น้ำประปา" บนหน้าแรก (ไม่ต้องล็อกอิน)
// แสดงเฉพาะน้ำประปาจ่ายออก (tap) · ข้อมูลจาก /api/smart-papar/water-quality/public-summary (ตัวเลขรวมเท่านั้น)
// ใช้ CitizenShell — /papar ต้องอยู่ในรายการ citizen route ของ components/Layout.js (exact, ไม่รวม /papar/flushing)
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Atom, CalendarDays, Droplet, FlaskConical, ShowerHead } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import { ntuShade, waterLevel } from "@/lib/citizen/waterLevel";
import { WATER_STANDARDS, phWithin, tdsWithin, ntuWithin } from "@/lib/smart-papar/publicSummary";

const fmtDate = (ymd, opts = { day: "numeric", month: "short", year: "2-digit" }) =>
  ymd ? new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts }) : "-";
const fmtNum = (v, digits) => (v === null || v === undefined ? "–" : Number(v).toFixed(digits));

const DAYS_PREVIEW = 5;
const card = "rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]";

// ไอคอนใหญ่จาง ๆ มุมการ์ด (ตกแต่งอย่างเดียว) — สีตามสถานะของค่า: ปกติ = สีของค่า · เกินเกณฑ์ = แดง
// การ์ดที่ใส่ต้องเป็น relative overflow-hidden และเนื้อหาต้อง relative เพื่ออยู่เหนือไอคอน
function BgIcon({ icon: Icon, color, size = 110, className = "-bottom-4 -right-4" }) {
  return (
    <Icon
      aria-hidden
      size={size}
      strokeWidth={1.4}
      className={`pointer-events-none absolute ${className}`}
      style={{ color, opacity: 0.12 }}
    />
  );
}

const statusColor = (ok) => (ok === false ? "#DC2626" : ok === null ? "#9590A8" : "#16A34A");

function Verdict({ ok }) {
  if (ok === null) return <span className="text-xs text-[#9590A8]">ไม่มีข้อมูล</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        ok ? "bg-[#E6F6EE] text-[#15803D]" : "bg-[#FDE5E7] text-[#B91C1C]"
      }`}
    >
      {ok ? "✓ อยู่ในเกณฑ์มาตรฐาน" : "! เกินเกณฑ์มาตรฐาน"}
    </span>
  );
}

function MetricCard({ title, value, unit, ok, criteria, explain, icon }) {
  return (
    <div className={`${card} relative flex flex-col gap-2 overflow-hidden`}>
      {icon && <BgIcon icon={icon} color={statusColor(ok)} size={96} />}
      <div className="relative text-[12px] font-semibold text-[#6B6880]">{title}</div>
      <div className="relative flex items-baseline gap-1">
        <span className="text-[30px] font-bold leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[11px] text-[#9590A8]">{unit}</span>}
      </div>
      <div className="relative">
        <Verdict ok={ok} />
      </div>
      <div className="relative text-[12px] text-[#6B6880]">{criteria}</div>
      <p className="relative text-[12px] leading-relaxed text-[#9590A8]">{explain}</p>
    </div>
  );
}

export default function PaparPublicPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [showAllDays, setShowAllDays] = useState(false); // ตารางแสดง 5 วันล่าสุด กด "ดูเพิ่มเติม" ถึงเห็นครบ 30

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
  const flushing = data?.flushing || [];
  const today = flushing[0];

  return (
    <>
      <Head>
        <title>คุณภาพน้ำประปา | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ค่าความขุ่น pH และ TDS ของน้ำประปาเทศบาลเมืองตาคลี ย้อนหลัง 30 วัน และผลงานโบตะกอน" />
      </Head>
      <CitizenShell>
        <div className="space-y-3 px-4 pb-8 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-[#7C3AED] shadow-sm"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            กลับหน้าแรก
          </Link>

          <div>
            <h1 className="text-[20px] font-bold">คุณภาพน้ำประปา</h1>
            <p className="text-[12px] text-[#6B6880]">น้ำประปาที่จ่ายออกจากโรงกรองประปาเทศบาลเมืองตาคลี</p>
          </div>

          {state === "loading" && <div className={`${card} py-10 text-center text-sm text-[#9590A8]`}>กำลังโหลด…</div>}
          {state === "error" && (
            <div className={`${card} py-10 text-center text-sm text-[#B91C1C]`}>โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</div>
          )}

          {state === "ready" && (
            <>
              {/* 1. NTU */}
              <section className={`${card} relative overflow-hidden`} aria-label="ค่าความขุ่นล่าสุด">
                <BgIcon icon={Droplet} color={level.key === "none" ? "#9590A8" : level.dot} size={150} className="-bottom-6 -right-6" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-[#6B6880]">ความขุ่น (NTU)</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-[44px] font-bold leading-none tabular-nums" style={{ color: level.key === "none" ? "#9590A8" : level.chipText }}>
                        {fmtNum(latest?.ntu, 2)}
                      </span>
                      <span className="text-[12px] text-[#9590A8]">NTU</span>
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                    style={{ background: level.chipBg, color: level.chipText }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.dot }} />
                    {level.label}
                  </span>
                </div>
                <div className="relative mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Verdict ok={ntuWithin(latest?.ntu)} />
                  <span className="text-[12px] text-[#6B6880]">ข้อมูลวันที่ {fmtDate(latest?.recordDate, { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <p className="relative mt-3 rounded-xl bg-[#F6F5FA]/90 px-3 py-2 text-[12px] leading-relaxed text-[#6B6880]">
                  *ค่ามาตรฐานของกรมอนามัยไม่เกิน {WATER_STANDARDS.ntuMax} NTU สามารถใช้อุปโภคบริโภคได้ (ณ หน้าโรงกรองประปาเทศบาลเมืองตาคลี)
                </p>
              </section>

              {/* 2. pH + TDS */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  title="pH (กรด-ด่าง)"
                  value={fmtNum(latest?.ph, 2)}
                  ok={phWithin(latest?.ph)}
                  icon={FlaskConical}
                  criteria={`เกณฑ์ ${WATER_STANDARDS.phMin}–${WATER_STANDARDS.phMax}`}
                  explain="ต่ำกว่า 7 เป็นกรด สูงกว่า 7 เป็นด่าง น้ำดื่มควรเป็นกลางหรือด่างอ่อน"
                />
                <MetricCard
                  title="TDS (สารละลาย)"
                  value={fmtNum(latest?.tds, 0)}
                  unit="mg/L"
                  ok={tdsWithin(latest?.tds)}
                  icon={Atom}
                  criteria={`เกณฑ์ไม่เกิน ${WATER_STANDARDS.tdsMax} mg/L`}
                  explain="ปริมาณแร่ธาตุและสารที่ละลายอยู่ในน้ำ ยิ่งน้อยน้ำยิ่งบริสุทธิ์"
                />
              </div>

              {/* 3. ตาราง 30 วัน */}
              <section className={`${card} relative overflow-hidden`} aria-label="ผลตรวจน้ำประปา 30 วันล่าสุด">
                <BgIcon icon={CalendarDays} color="#7C3AED" size={90} className="-right-4 -top-4" />
                <div className="relative mb-2 flex items-baseline justify-between">
                  <h2 className="text-[15px] font-bold">ผลตรวจ 30 วันล่าสุด</h2>
                  <span className="text-[11px] text-[#9590A8]">นับเฉพาะวันที่มีการตรวจวัด</span>
                </div>
                {data.daily.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#9590A8]">ยังไม่มีข้อมูล</p>
                ) : (
                  <table className="relative w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] text-[#9590A8]">
                        <th className="py-1.5 font-semibold">วันที่</th>
                        <th className="py-1.5 text-right font-semibold">NTU</th>
                        <th className="py-1.5 text-right font-semibold">pH</th>
                        <th className="py-1.5 text-right font-semibold">TDS</th>
                        <th className="py-1.5 text-right font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllDays ? data.daily : data.daily.slice(0, DAYS_PREVIEW)).map((r) => (
                        <tr key={r.recordDate} className="border-t border-[#F1F0F5]">
                          <td className="py-2">{fmtDate(r.recordDate)}</td>
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
                          <td className={`py-2 text-right tabular-nums ${phWithin(r.ph) === false ? "font-semibold text-[#B91C1C]" : ""}`}>{fmtNum(r.ph, 2)}</td>
                          <td className={`py-2 text-right tabular-nums ${tdsWithin(r.tds) === false ? "font-semibold text-[#B91C1C]" : ""}`}>{fmtNum(r.tds, 0)}</td>
                          <td className="py-2 text-right">
                            {r.status === "ok" ? (
                              <span className="text-[12px] font-semibold text-[#15803D]">✓ ปกติ</span>
                            ) : r.status === "over" ? (
                              <span className="text-[12px] font-semibold text-[#B91C1C]">เกินเกณฑ์</span>
                            ) : (
                              <span className="text-[12px] text-[#9590A8]">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {data.daily.length > DAYS_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllDays((v) => !v)}
                    aria-expanded={showAllDays}
                    className="relative mt-2 w-full rounded-xl bg-[#F6F5FA] py-2.5 text-[13px] font-semibold text-[#7C3AED]"
                  >
                    {showAllDays ? "ย่อเหลือ 5 วันล่าสุด" : `ดูเพิ่มเติม (${data.daily.length - DAYS_PREVIEW} วัน)`}
                  </button>
                )}
              </section>

              {/* 4. งานโบตะกอน */}
              <section className={`${card} relative overflow-hidden`} aria-label="ผลงานโบตะกอน">
                <BgIcon icon={ShowerHead} color="#3B82F6" size={120} className="-right-5 -top-5" />
                <h2 className="relative text-[15px] font-bold">งานโบตะกอน</h2>
                <p className="relative text-[11px] text-[#9590A8]">ระบายตะกอนในท่อเมื่อน้ำขุ่น · % จุดที่โบแล้วน้ำใส</p>
                {!today ? (
                  <p className="py-6 text-center text-sm text-[#9590A8]">ยังไม่มีงานโบตะกอนใน 30 วันล่าสุด</p>
                ) : (
                  <>
                    <div className="relative mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[40px] font-bold leading-none tabular-nums text-[#2563EB]">{today.clearPct}</span>
                          <span className="text-[14px] font-semibold text-[#2563EB]">%</span>
                        </div>
                        <div className="mt-1 text-[12px] text-[#6B6880]">
                          ใสแล้ว {today.clear} จาก {today.total} จุด · {fmtDate(today.date, { day: "numeric", month: "long" })}
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-[#E6F1FE]">
                      <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${today.clearPct}%` }} />
                    </div>
                    <table className="relative mt-4 w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] text-[#9590A8]">
                          <th className="py-1.5 font-semibold">วันที่</th>
                          <th className="py-1.5 text-right font-semibold">จุดที่โบ</th>
                          <th className="py-1.5 text-right font-semibold">ใสแล้ว</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flushing.slice(0, 3).map((d) => (
                          <tr key={d.date} className="border-t border-[#F1F0F5]">
                            <td className="py-2">{fmtDate(d.date)}</td>
                            <td className="py-2 text-right tabular-nums">{d.total}</td>
                            <td className="py-2 text-right font-semibold tabular-nums text-[#2563EB]">{d.clearPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>
            </>
          )}

          {/* 5. ปุ่มโบตะกอน (หน้าเจ้าหน้าที่) */}
          <Link
            href="/papar/flushing"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#08465A] text-[15px] font-semibold text-white shadow-sm"
          >
            โบตะกอน
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <p className="text-center text-[11px] text-[#9590A8]">สำหรับเจ้าหน้าที่บันทึกงานโบตะกอน</p>
        </div>
      </CitizenShell>
    </>
  );
}
