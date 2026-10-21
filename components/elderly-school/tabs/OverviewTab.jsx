// แท็บ "ภาพรวม" — ความคืบหน้าหลักสูตร, ตัวเลขหลัก, สุขภาพทั้งกลุ่ม (ขึ้นต้นด้วยคนที่อยู่ในเกณฑ์ดี), รายชื่อที่ต้องติดตาม
import React, { useMemo } from "react";
import {
  indicatorTiles,
  needsCloseFollowUp,
  followUpFlags,
  nextSession,
  formatThaiDate,
} from "@/lib/elderly-school/followUp";
import { useDashboard, useSchedule } from "../useElderlyData";
import {
  TONE_STYLES,
  Chip,
  SectionCard,
  StatTile,
  ProgressBar,
  Notice,
  Spinner,
  EmptyState,
  primaryBtnCls,
} from "../elderlyTheme";

const TILE_ICONS = {
  bp: "M3 12h4l3-8 4 16 3-8h4",
  bmi: "M12 3a4 4 0 100 8 4 4 0 000-8zM5 21c0-4 3-7 7-7s7 3 7 7",
  whtr: "M4 12h16M7 8c2-2 8-2 10 0M7 16c2 2 8 2 10 0",
  ncd: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  pulse: "M12 21s-7-4.5-7-11a4 4 0 017-2.6A4 4 0 0119 10c0 6.5-7 11-7 11z",
  "2q": "M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
};

const LEGEND = [
  ["ok", "เกณฑ์ดี"],
  ["care", "ควรดูแล"],
  ["see", "ควรพบเจ้าหน้าที่"],
  ["none", "ยังไม่มีข้อมูล"],
];

function HealthTile({ t, onOpen }) {
  const segs = [
    ["ok", t.ok],
    ["care", t.care],
    ["see", t.see],
    ["none", t.none],
  ].filter(([, n]) => n > 0);
  return (
    <div className="p-[18px] rounded-2xl bg-[#FBFAF7] border border-[#EFEDE6] flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 shrink-0 rounded-[10px] bg-[#E3F0EE] flex items-center justify-center" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E5A55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={TILE_ICONS[t.key]} />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-bold">{t.name}</span>
          <span className="text-xs text-[#5B635F]">{t.hint}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[32px] font-bold leading-none text-[#0E5A55]">{t.pct === null ? "—" : `${t.pct}%`}</span>
        <span className="text-sm text-[#3C4541]">
          อยู่ในเกณฑ์ดี ({t.ok} จาก {t.total} คน)
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-white" aria-hidden="true">
        {segs.map(([k, n]) => (
          <div key={k} style={{ width: `${(n / t.total) * 100}%`, background: TONE_STYLES[k].bar }} />
        ))}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={t.careCount === 0}
        className="flex items-center justify-between gap-2 min-h-10 px-3 rounded-[10px] bg-white border border-[#E4E2DA] text-sm text-[#3C4541] hover:bg-[#F4F3EE] disabled:opacity-60 disabled:cursor-default"
      >
        <span>{t.careCount === 0 ? "ไม่มีคนที่ต้องดูแลเพิ่ม" : t.careText}</span>
        {t.careCount > 0 && <span className="font-semibold text-[#0E5A55]">ดูรายชื่อ →</span>}
      </button>
    </div>
  );
}

export default function OverviewTab({ yearBE, go }) {
  const dash = useDashboard(yearBE, "latest");
  const sched = useSchedule(yearBE);
  const data = dash.data;
  const people = useMemo(() => (Array.isArray(data?.people) ? data.people : []), [data]);

  const tiles = useMemo(() => indicatorTiles(data), [data]);
  const registered = data?.totals?.registered ?? 0;
  const followUps = useMemo(
    () =>
      people
        .filter(needsCloseFollowUp)
        .map((p) => ({ p, flags: followUpFlags(p) }))
        .sort((a, b) => b.flags.length - a.flags.length || a.p.fullName.localeCompare(b.p.fullName, "th")),
    [people]
  );
  const screened =
    (data?.mentalHealth?.ok ?? 0) + (data?.mentalHealth?.risk ?? 0) + (data?.mentalHealthOthers?.length ?? 0);
  const notScreened = Math.max(0, registered - screened);

  const statuses = sched.statuses;
  const doneCount = statuses.filter((s) => s.status === "done" || s.status === "today").length;
  const next = nextSession(statuses);
  const attendance = Array.isArray(data?.attendance) ? data.attendance : [];
  const lastAttended = [...attendance].reverse().find((a) => a.count > 0) || null;
  const withData = attendance.filter((a) => a.count > 0);
  const avgAttend = withData.length ? Math.round(withData.reduce((s, a) => s + a.count, 0) / withData.length) : null;
  const maxAttend = Math.max(registered, ...attendance.map((a) => a.count), 1);

  if (dash.loading && !data) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      {dash.error && <Notice tone="see">โหลดข้อมูลไม่ได้: {dash.error}</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">ปี {yearBE} · สรุปจากผลวัดครั้งล่าสุดของแต่ละคน</span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">ภาพรวมสุขภาพผู้เรียน</h2>
        </div>
        <button type="button" className={primaryBtnCls} onClick={() => go("visits", next ? { visit: next.visitNo } : {})}>
          {next ? `เปิดบันทึกครั้งที่ ${next.visitNo}` : "เปิดบันทึกการมาเรียน"}
        </button>
      </div>

      <SectionCard
        title="ความคืบหน้าหลักสูตร 16 ครั้ง"
        action={
          <span className="text-sm text-[#3C4541]">
            เรียนแล้ว <strong>{doneCount}</strong> ครั้ง
            {next && (
              <>
                {" "}· ครั้งถัดไป <strong>ครั้งที่ {next.visitNo} · {formatThaiDate(next.dateISO)}</strong>
              </>
            )}
            {!next && statuses.some((s) => s.status === "unset") && (
              <>
                {" "}·{" "}
                <button type="button" className="font-semibold text-[#0E5A55] underline" onClick={() => go("schedule")}>
                  ตั้งวันเรียนที่เหลือ
                </button>
              </>
            )}
          </span>
        }
      >
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
          {statuses.map((s) => {
            const bar =
              s.status === "done" ? "#0E5A55" : s.status === "today" || s === next ? "#E9A93B" : s.status === "scheduled" ? "#A9C9C4" : "#E4E2DA";
            return (
              <div key={s.visitNo} className="flex flex-col items-center gap-1.5" title={s.dateISO ? formatThaiDate(s.dateISO) : "ยังไม่ตั้งวัน"}>
                <div className="w-full h-2.5 rounded-full" style={{ background: bar }} />
                <span className={"text-xs " + (s === next ? "font-bold text-[#7A4700]" : "text-[#5B635F]")}>{s.visitNo}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <section aria-label="ตัวชี้วัดหลัก" className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <StatTile label="ผู้เรียนในปีนี้" value={registered} unit="คน" sub={`มีผลวัดแล้ว ${data?.totals?.peopleCounted ?? 0} คน`} />
        <StatTile
          label={lastAttended ? `มีผลวัดครั้งที่ ${lastAttended.visitNo}` : "มีผลวัดครั้งล่าสุด"}
          value={lastAttended ? lastAttended.count : "—"}
          unit={registered ? `/ ${registered}` : ""}
          sub={lastAttended && registered ? `${Math.round((lastAttended.count / registered) * 100)}% ของผู้เรียน` : undefined}
        >
          {lastAttended && <ProgressBar value={lastAttended.count} max={registered} />}
        </StatTile>
        <StatTile label="ต้องติดตามใกล้ชิด" value={followUps.length} unit="คน" tone={followUps.length ? "see" : undefined} sub="ความดันสูง · NCD 3/3 · 2Q บวก · ชีพจรผิดปกติ" />
        <StatTile label="ยังไม่ได้คัดกรอง 2Q ปีนี้" value={notScreened} unit="คน" tone={notScreened ? "care" : undefined}>
          {notScreened > 0 && (
            <button type="button" className="self-start text-[13px] font-semibold text-[#0E5A55] underline" onClick={() => go("screening")}>
              เริ่มคัดกรองรายชื่อนี้ →
            </button>
          )}
        </StatTile>
      </section>

      <div className="flex flex-wrap gap-6 items-start">
        <SectionCard
          className="flex-[3_1_560px] min-w-0"
          title="สุขภาพทั้งกลุ่ม"
          subtitle="สัดส่วนผู้เรียนที่อยู่ในเกณฑ์ดี · กดเพื่อดูรายชื่อที่ควรดูแลเพิ่ม"
          action={
            <div className="flex flex-wrap gap-3.5 text-[13px] text-[#3C4541]">
              {LEGEND.map(([k, label]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE_STYLES[k].bar }} />
                  {label}
                </span>
              ))}
            </div>
          }
        >
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {tiles.map((t) => (
              <HealthTile key={t.key} t={t} onOpen={() => go("registry", { filter: t.key })} />
            ))}
          </div>
          <p className="mt-4 mb-0 text-[13px] text-[#5B635F]">
            เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย ควรวัดซ้ำและดูแนวโน้มหลายครั้งก่อนสรุป
          </p>
          <details className="mt-3 text-[13px] text-[#3C4541]">
            <summary className="cursor-pointer font-semibold text-[#1D2421]">เกณฑ์ที่ใช้</summary>
            <ul className="mt-2 mb-0 pl-5 flex flex-col gap-1">
              <li>ความดัน: ต่ำ &lt;90 หรือ &lt;60 · ปกติ &lt;120 และ &lt;80 · สูง ≥140 หรือ ≥90 · ที่เหลือ = เฝ้าระวัง</li>
              <li>BMI: ผอม &lt;18.5 · ปกติ 18.5–22.9 · ท้วม 23–24.9 · อ้วน 1: 25–29.9 · อ้วน 2: ≥30</li>
              <li>รอบเอว (WHtR = รอบเอว ÷ ส่วนสูง): ≥0.5 = เสี่ยงอ้วนลงพุง</li>
              <li>ความเสี่ยงโรคเรื้อรัง (NCD) 0–3 คะแนน จาก WHtR ≥0.5, BMI ≥25, ความดัน ≥130/85 · ≥2 = เสี่ยงสูง</li>
              <li>ชีพจร: &lt;50 ต่ำ · 50–100 ปกติ · &gt;100 สูง</li>
              <li>สุขภาพใจ: 2Q ตอบ “ใช่” อย่างน้อย 1 ข้อ = 2Q บวก</li>
            </ul>
          </details>
        </SectionCard>

        <div className="flex-[2_1_380px] min-w-0 flex flex-col gap-6">
          <SectionCard
            title="ต้องติดตาม"
            action={
              followUps.length > 0 && (
                <button type="button" className="text-sm font-semibold text-[#0E5A55]" onClick={() => go("registry", { quick: "follow" })}>
                  ดูทั้งหมด
                </button>
              )
            }
            bodyClassName="px-5 pb-4 pt-2"
          >
            {followUps.length === 0 ? (
              <EmptyState>ยังไม่มีผู้ที่ต้องติดตามใกล้ชิด</EmptyState>
            ) : (
              <ul className="m-0 p-0 list-none">
                {followUps.slice(0, 6).map(({ p, flags }) => (
                  <li key={p.personId} className="border-t border-[#EFEDE6] first:border-t-0">
                    <button
                      type="button"
                      onClick={() => go("registry", { person: p.personId })}
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-xl text-left hover:bg-[#F4F3EE]"
                    >
                      <span className="w-10 h-10 shrink-0 rounded-full bg-[#ECEAE3] flex items-center justify-center font-bold text-[#3C4541]" aria-hidden="true">
                        {(p.fullName || "?").replace(/^(นาย|นางสาว|นาง)/, "").trim().charAt(0) || "?"}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="text-[15px] font-semibold truncate">{p.fullName || "-"}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {flags.map((f) => (
                            <Chip key={f.key} tone={f.tone}>
                              {f.label}
                            </Chip>
                          ))}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-[#8A918D]">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="จำนวนผู้มีผลวัดแต่ละครั้ง"
            action={avgAttend !== null && <span className="text-[13px] text-[#5B635F]">เฉลี่ย {avgAttend} คน/ครั้ง</span>}
          >
            <div className="grid gap-1.5 items-end h-40 border-b border-[#D6D3C8]" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {attendance.map((a) => (
                <div key={a.visitNo} className="flex flex-col justify-end items-center h-full gap-1">
                  <span className="text-[11px] text-[#3C4541]">{a.count || ""}</span>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: a.count ? `${(a.count / maxAttend) * 130}px` : "4px",
                      background: a.count ? (a === lastAttended ? "#0E5A55" : "#7FB3AD") : "#E4E2DA",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-1.5 mt-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {attendance.map((a) => (
                <span key={a.visitNo} className="text-[11px] text-[#5B635F] text-center">
                  {a.visitNo}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
