// ปฏิทินงานตามรอบ — ทีมไหนต้องไปหัวไหน วันไหน (แท็บรายงาน → ครบรอบประจำ → มุมมองปฏิทิน)
// คำนวณช่องปฏิทินด้วย lib/smart-papar/flushingWork.js#buildDueCalendar (3 สัปดาห์ เริ่มวันอาทิตย์)
// สีทีมต้องตรงกับกราฟผลงาน (teamColor มาจาก FlushingReport) · ช่องวันที่บอกจำนวนด้วยตัวเลขเสมอ ไม่พึ่งสีอย่างเดียว
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { buildDueCalendar } from "@/lib/smart-papar/flushingWork";

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const fmtYmd = (ymd, opts = { day: "numeric", month: "short" }) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });
const dayNum = (ymd) => Number(ymd.slice(8, 10));
const mapsUrl = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`;
const WORK_TAG = { routine: "ครบรอบ", reflush: "โบซ้ำ" };

// ตัวอักษรบนชิปสีทีม — พื้นอ่อนใช้ตัวเข้ม ให้ผ่าน 4.5:1
function inkOn(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? "#0B2233" : "#FFFFFF";
}

function countByTeam(items) {
  const m = new Map();
  for (const i of items) m.set(i.teamKey || "", (m.get(i.teamKey || "") || 0) + 1);
  return [...m.entries()];
}

function DayList({ title, items, teamLabel, teamColor, emptyText }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      const k = i.teamKey || "";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(i);
    }
    return [...m.entries()];
  }, [items]);
  return (
    <div className="space-y-3 rounded-2xl bg-pp-ground p-4">
      <h4 className="font-tk-sans text-lg font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-pp-muted">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(([k, list]) => (
            <div key={k || "none"} className="overflow-hidden rounded-xl bg-white">
              <div className="flex items-center gap-2 border-b border-pp-line px-3.5 py-2.5">
                <span className="h-3 w-3 rounded" style={{ background: teamColor(k) }} />
                <span className="flex-1 font-semibold">{teamLabel(k)}</span>
                <span className="text-sm text-pp-muted">{list.length} จุด</span>
              </div>
              <ul className="divide-y divide-pp-line/70">
                {list.map((i) => (
                  <li key={i.pointId} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${
                        i.work === "reflush" ? "bg-pp-turbid-wash text-pp-turbid-ink" : "bg-pp-tint-2 text-pp-water"
                      }`}
                    >
                      {WORK_TAG[i.work]}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px]">
                      <span className="font-tk-mono text-sm">{i.code}</span>
                      {(i.name || i.roadName) && ` · ${i.name || i.roadName}`}
                      {i.dueYmd && i.bucket === "overdue" && (
                        <span className="block text-xs font-semibold text-pp-danger">ครบ {fmtYmd(i.dueYmd)} (เลย {-i.daysLeft} วัน)</span>
                      )}
                    </span>
                    {i.coordinates && (
                      <a
                        href={mapsUrl(i.coordinates)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`นำทางไป ${i.code}`}
                        className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-pp-line text-pp-water"
                      >
                        <MapPin size={16} aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlushingDueCalendar({ items, today, teams, teamLabel, teamColor }) {
  const [includeReflush, setIncludeReflush] = useState(false);
  const cal = useMemo(() => buildDueCalendar(items, today, { includeReflush }), [items, today, includeReflush]);
  const firstWithWork = cal.weeks.flat().find((d) => !d.isPast && d.items.length > 0)?.ymd;
  const [picked, setPicked] = useState(null); // ymd | "overdue" | null (= อัตโนมัติ)
  const sel = picked ?? (cal.overdue.length ? "overdue" : firstWithWork || today);
  const selDay = sel === "overdue" ? null : cal.weeks.flat().find((d) => d.ymd === sel);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-pp-muted">
          {fmtYmd(cal.start)} – {fmtYmd(cal.end, { day: "numeric", month: "short", year: "2-digit" })}
          {cal.after > 0 && ` · หลังจากนี้อีก ${cal.after} จุด`}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex flex-wrap gap-3 text-[13px] text-pp-muted">
            {teams.map((t) => (
              <span key={t.key || "none"} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: teamColor(t.key) }} />
                {t.label}
              </span>
            ))}
          </span>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeReflush}
              onChange={(e) => setIncludeReflush(e.target.checked)}
              className="h-5 w-5 accent-[#0E6E86]"
            />
            รวมงานโบซ้ำ (รอบ 5 วัน)
          </label>
        </div>
      </div>

      {cal.overdue.length > 0 && (
        <button
          type="button"
          aria-pressed={sel === "overdue"}
          onClick={() => setPicked("overdue")}
          className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border-2 px-4 py-3 text-left ${
            sel === "overdue" ? "border-pp-danger bg-[#FDF0EF]" : "border-transparent bg-[#FDF0EF]"
          }`}
        >
          <span className="font-semibold text-pp-danger">เลยกำหนด {cal.overdue.length} จุด — ต้องไปก่อน</span>
          {countByTeam(cal.overdue).map(([k, n]) => (
            <span key={k || "none"} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: teamColor(k) }} />
              {teamLabel(k)} {n}
            </span>
          ))}
        </button>
      )}

      <div className="overflow-hidden rounded-xl border border-pp-line">
        <div className="grid grid-cols-7 bg-pp-ground text-center text-[13px] font-semibold text-pp-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        {cal.weeks.map((week) => (
          <div key={week[0].ymd} className="grid grid-cols-7 border-t border-pp-line">
            {week.map((d) => {
              const on = sel === d.ymd;
              const counts = countByTeam(d.items);
              return (
                <button
                  key={d.ymd}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${fmtYmd(d.ymd, { weekday: "long", day: "numeric", month: "long" })} ${d.items.length} จุด`}
                  onClick={() => setPicked(d.ymd)}
                  className={`flex min-h-[92px] min-w-0 flex-col gap-1 border-l border-pp-line p-1.5 text-left first:border-l-0 sm:p-2 ${
                    on ? "bg-pp-tint-2 ring-2 ring-inset ring-pp-water" : d.isPast ? "bg-pp-ground/60" : "bg-white hover:bg-pp-tint-2"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                      d.isToday ? "bg-pp-water font-semibold text-white" : d.isPast ? "text-pp-muted" : ""
                    }`}
                  >
                    {dayNum(d.ymd)}
                  </span>
                  {d.items.length > 0 && (
                    <>
                      {/* จอแคบ: ตัวเลขรวม · จอกว้าง: แยกทีม */}
                      <span className="font-tk-sans text-lg font-bold leading-none sm:hidden">{d.items.length}</span>
                      <span className="hidden flex-col gap-1 sm:flex">
                        {counts.map(([k, n]) => (
                          <span
                            key={k || "none"}
                            className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                            style={{ background: teamColor(k), color: inkOn(teamColor(k)) }}
                          >
                            <span className="truncate">{teamLabel(k)}</span>
                            <span className="ml-auto tabular-nums">{n}</span>
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {sel === "overdue" ? (
        <DayList title="เลยกำหนด — ต้องไปก่อน" items={cal.overdue} teamLabel={teamLabel} teamColor={teamColor} emptyText="" />
      ) : (
        selDay && (
          <DayList
            title={`${fmtYmd(selDay.ymd, { weekday: "long", day: "numeric", month: "long" })}${selDay.isToday ? " (วันนี้)" : ""}`}
            items={selDay.items}
            teamLabel={teamLabel}
            teamColor={teamColor}
            emptyText="ไม่มีหัวที่ครบรอบวันนี้"
          />
        )
      )}
    </div>
  );
}
