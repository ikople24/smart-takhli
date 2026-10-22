// แท็บ "ทะเบียนผู้เรียน" — รายชื่อทั้งปีพร้อมสถานะล่าสุด + แผงประวัติรายคน
import React, { useMemo, useState } from "react";
import { MISSED_STREAK_ALERT, bmiChip, bpChip, mhChip, ncdChip, needsCloseFollowUp } from "@/lib/elderly-school/followUp";
import { mergeRoster, useDashboard, useRoster, useSchedule } from "../useElderlyData";
import PersonProfilePanel from "../PersonProfilePanel";
import { Chip, EmptyState, Notice, Spinner, cardCls, filterCls, inputCls, maskCitizen, btnCls } from "../elderlyTheme";

const PAGE_SIZE = 15;

// test รับทั้งแถว (r.metrics = ผลวัดล่าสุด, r.follow = ข้อมูลรวมสำหรับการติดตาม)
const QUICK = [
  { key: "all", label: "ทั้งหมด", test: () => true },
  { key: "follow", label: "ต้องติดตาม", test: (r) => needsCloseFollowUp(r.follow) },
  { key: "absent", label: `ขาดเรียน ${MISSED_STREAK_ALERT} ครั้งติดกัน`, test: (r) => r.missedStreak >= MISSED_STREAK_ALERT },
  { key: "bphigh", label: "ความดันสูง", test: (r) => r.metrics?.bp?.category === "high" },
  { key: "q2pos", label: "2Q บวก", test: (r) => r.mh?.q2Positive === true },
  { key: "nodata", label: "ยังไม่มีผลวัด", test: (r) => !r.metrics },
];

// ตัวกรองจากการ์ด "สุขภาพทั้งกลุ่ม" ในแท็บภาพรวม = คนที่ควรดูแลเพิ่มในตัวชี้วัดนั้น
const INDICATOR = {
  bp: { label: "ความดัน: ควรดูแล", test: (m) => ["low", "risk", "high"].includes(m?.bp?.category) },
  bmi: { label: "BMI: ควรดูแล", test: (m) => m?.bmiRisk === true },
  whtr: { label: "รอบเอว: เสี่ยง", test: (m) => m?.abdominalRisk === true },
  ncd: { label: "NCD: เสี่ยงสูง", test: (m) => m?.metabolicRiskHigh === true },
  pulse: { label: "ชีพจร: ผิดปกติ", test: (m) => m?.pulseCategory === "low" || m?.pulseCategory === "high" },
  "2q": { label: "2Q บวก", test: (m) => m?.mentalHealth?.q2Positive === true },
};

function q1(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default function RegistryTab({ yearBE, query, setQuery, go }) {
  const dash = useDashboard(yearBE, "latest");
  const roster = useRoster(yearBE);
  const sched = useSchedule(yearBE);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const quick = q1(query.quick) || "all";
  const indicator = INDICATOR[q1(query.filter)] ? q1(query.filter) : null;
  const selectedId = q1(query.person) || null;

  const rows = useMemo(
    () => mergeRoster(roster.people, dash.data?.people, dash.data?.mentalHealthOthers, dash.data?.attendanceByPerson),
    [roster.people, dash.data]
  );
  const doneSessions = sched.statuses.filter((s) => s.status === "done" || s.status === "today").length;

  const counts = useMemo(() => Object.fromEntries(QUICK.map((f) => [f.key, rows.filter((r) => f.test(r)).length])), [rows]);

  const filtered = useMemo(() => {
    const qs = search.trim().toLowerCase();
    const quickTest = (QUICK.find((f) => f.key === quick) || QUICK[0]).test;
    return rows.filter((r) => {
      if (!quickTest(r)) return false;
      if (indicator && !INDICATOR[indicator].test(r.metrics)) return false;
      if (!qs) return true;
      const digits = String(r.citizenId).replace(/\D/g, "");
      return r.fullName.toLowerCase().includes(qs) || (qs.length >= 4 && digits.endsWith(qs));
    });
  }, [rows, quick, indicator, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = rows.find((r) => r.personId === selectedId) || null;

  const loading = (dash.loading && !dash.data) || (roster.loading && !roster.data);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">
            ปี {yearBE} · {rows.length} คน
          </span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">ทะเบียนผู้เรียน</h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          aria-label="ค้นหา"
          placeholder="ค้นหาชื่อ หรือเลขบัตร 4 ตัวท้าย"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={inputCls + " flex-[1_1_280px] min-w-0 !min-h-12"}
        />
        <div role="group" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
          {QUICK.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={quick === f.key}
              className={filterCls(quick === f.key)}
              onClick={() => {
                setQuery({ quick: f.key === "all" ? null : f.key });
                setPage(1);
              }}
            >
              {f.label} {counts[f.key] ?? 0}
            </button>
          ))}
          {indicator && (
            <button type="button" className={filterCls(true)} onClick={() => setQuery({ filter: null })} aria-label={`ล้างตัวกรอง ${INDICATOR[indicator].label}`}>
              {INDICATOR[indicator].label} ✕
            </button>
          )}
        </div>
      </div>

      {(dash.error || roster.error) && <Notice tone="see">{dash.error || roster.error}</Notice>}

      <div className="flex flex-wrap gap-5 items-start">
        <section className={cardCls + " flex-[3_1_560px] min-w-0 overflow-hidden"} aria-label="รายชื่อ">
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <EmptyState>ไม่พบรายชื่อตามตัวกรอง</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FBFAF7] text-left text-xs font-semibold text-[#5B635F]">
                    {["ชื่อ-นามสกุล", "มาเรียน", "ความดันล่าสุด", "BMI", "NCD", "2Q"].map((h) => (
                      <th key={h} className="py-2.5 px-3 border-b border-[#E4E2DA] whitespace-nowrap first:pl-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const m = r.metrics;
                    const bp = bpChip(m?.bp);
                    const bmi = bmiChip(m?.bmiCategory);
                    const ncd = ncdChip(m?.metabolicRiskScore);
                    const mh = mhChip(r.mh);
                    const att = r.attended;
                    const on = r.personId === selectedId;
                    return (
                      <tr
                        key={r.personId}
                        className={"cursor-pointer " + (on ? "bg-[#F0F7F6]" : "hover:bg-[#FBFAF7]")}
                        onClick={() => setQuery({ person: r.personId })}
                      >
                        <td className="py-3 px-3 pl-5 border-b border-[#EFEDE6]">
                          <button
                            type="button"
                            className="flex flex-col text-left"
                            aria-pressed={on}
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuery({ person: r.personId });
                            }}
                          >
                            <span className="font-semibold whitespace-nowrap">{r.fullName || "-"}</span>
                            <span className="text-xs text-[#5B635F]">{maskCitizen(r.citizenId)}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 border-b border-[#EFEDE6] whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <span className="block w-14 h-1.5 rounded-full bg-[#ECEAE3] overflow-hidden" aria-hidden="true">
                              <span className="block h-full bg-[#0E5A55]" style={{ width: `${doneSessions ? Math.min(100, (att / doneSessions) * 100) : 0}%` }} />
                            </span>
                            {att}
                            {doneSessions ? `/${doneSessions}` : ""}
                            {r.missedStreak >= MISSED_STREAK_ALERT && <Chip tone="care">ขาด {r.missedStreak} ติดกัน</Chip>}
                          </span>
                        </td>
                        <td className="py-3 px-3 border-b border-[#EFEDE6]">
                          <Chip tone={bp.tone}>{bp.label}</Chip>
                        </td>
                        <td className="py-3 px-3 border-b border-[#EFEDE6]">
                          <Chip tone={bmi.tone}>{bmi.label}</Chip>
                        </td>
                        <td className="py-3 px-3 border-b border-[#EFEDE6]">
                          <Chip tone={ncd.tone}>{ncd.label}</Chip>
                        </td>
                        <td className="py-3 px-3 border-b border-[#EFEDE6]">
                          <Chip tone={mh.tone}>{mh.label}</Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 text-sm text-[#5B635F]">
            <span>
              แสดง {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} จาก {filtered.length} คน
            </span>
            <div className="flex gap-2">
              <button type="button" className={btnCls + " !min-h-10"} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                ก่อนหน้า
              </button>
              <button type="button" className={btnCls + " !min-h-10"} disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>
                ถัดไป
              </button>
            </div>
          </div>
        </section>

        <div className="flex-[2_1_400px] min-w-0">
          {selectedId ? (
            <PersonProfilePanel
              key={selectedId}
              personId={selectedId}
              metrics={selected?.metrics || null}
              follow={selected?.follow || null}
              yearBE={yearBE}
              statuses={sched.statuses}
              onChanged={() => {
                dash.reload();
                roster.reload();
              }}
              go={go}
            />
          ) : (
            <section className={cardCls + " p-6"}>
              <EmptyState>เลือกชื่อในตารางเพื่อดูประวัติสุขภาพรายคน</EmptyState>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
