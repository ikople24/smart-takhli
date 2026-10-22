// แท็บ "การมาเรียน" — เลือกครั้งที่ 1–16, กรอก/แก้ผลวัดทั้งห้องในตารางเดียว, ดูคนที่ยังไม่มา
import React, { useEffect, useMemo, useState } from "react";
import { bpCategory } from "@/lib/health/metrics";
import {
  defaultSessionNo,
  formatThaiDate,
  parseBpText,
  parseNumberField,
  pulseCategoryOf,
  visitResult,
} from "@/lib/elderly-school/followUp";
import { postJson, useDashboard, useRoster, useSchedule } from "../useElderlyData";
import VisitEditModal from "../VisitEditModal";
import {
  Chip,
  EmptyState,
  Notice,
  SectionCard,
  Spinner,
  TONE_STYLES,
  btnCls,
  cardCls,
  filterCls,
  inputCls,
  primaryBtnCls,
} from "../elderlyTheme";

const FIELDS = ["weightKg", "waistCm", "pulseBpm", "bp1", "bp2"];

function toDraft(p) {
  const raw = p?.raw || {};
  return {
    weightKg: raw.weightKg ?? "",
    waistCm: raw.waistCm ?? "",
    pulseBpm: raw.pulseBpm ?? "",
    bp1: raw.bp1Sys && raw.bp1Dia ? `${raw.bp1Sys}/${raw.bp1Dia}` : "",
    bp2: raw.bp2Sys && raw.bp2Dia ? `${raw.bp2Sys}/${raw.bp2Dia}` : "",
  };
}

function draftResult(d) {
  const b1 = parseBpText(d.bp1);
  const b2 = parseBpText(d.bp2);
  const sys = b1.sys ?? b2.sys;
  const dia = b1.dia ?? b2.dia;
  const bpCat = bpCategory(sys, dia);
  const pulseCat = pulseCategoryOf(parseNumberField(d.pulseBpm) ?? null);
  return {
    bpCat,
    pulseCat,
    bpBad: bpCat === "high" || bpCat === "low",
    pulseBad: pulseCat === "high" || pulseCat === "low",
    result: visitResult({ bpCategory: bpCat, pulseCategory: pulseCat }),
  };
}

function SourceChip({ source }) {
  if (source === "public-checkin") return <Chip tone="low">สแกน QR</Chip>;
  if (String(source || "").startsWith("sheet")) return <Chip tone="none">จากชีต</Chip>;
  return <Chip tone="none">เจ้าหน้าที่</Chip>;
}

export default function VisitsTab({ yearBE, query, setQuery, go }) {
  const sched = useSchedule(yearBE);
  const roster = useRoster(yearBE);
  const qVisit = Number(Array.isArray(query.visit) ? query.visit[0] : query.visit);
  const selectedNo =
    Number.isFinite(qVisit) && qVisit >= 1 && qVisit <= 16 ? qVisit : sched.loading ? null : defaultSessionNo(sched.statuses);

  const dash = useDashboard(selectedNo ? yearBE : null, selectedNo || "latest");
  const session = sched.statuses.find((s) => s.visitNo === selectedNo) || null;

  // แถวในตาราง = คนที่มีผลวัดครั้งนี้ (raw ค่าจาก API ไว้เทียบว่าแก้แล้วหรือยัง)
  const attendees = useMemo(() => {
    const people = Array.isArray(dash.data?.people) ? dash.data.people : [];
    return people
      .filter((p) => p.hasData)
      .map((p) => ({
        ...p,
        raw: {
          weightKg: p.weightKg,
          waistCm: p.waistCm,
          pulseBpm: p.pulseBpm,
          ...(p.bpReadings || {}),
        },
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
  }, [dash.data]);

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [rowError, setRowError] = useState("");
  const [search, setSearch] = useState("");
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [entryFor, setEntryFor] = useState(null);
  const [showAllAbsent, setShowAllAbsent] = useState(false);

  useEffect(() => {
    const next = {};
    for (const p of attendees) next[p.personId] = toDraft(p);
    setDrafts(next);
    setRowError("");
  }, [attendees]);

  const original = useMemo(() => Object.fromEntries(attendees.map((p) => [p.personId, toDraft(p)])), [attendees]);
  const isDirty = (id) => FIELDS.some((f) => String(drafts[id]?.[f] ?? "") !== String(original[id]?.[f] ?? ""));
  const dirtyIds = attendees.map((p) => p.personId).filter(isDirty);

  const attendeeIds = new Set(attendees.map((p) => p.personId));
  const streakById = new Map((dash.data?.attendanceByPerson || []).map((a) => [String(a.personId), a.missedStreak]));
  const absent = roster.people
    .filter((r) => !attendeeIds.has(String(r.personId)))
    .map((r) => ({ ...r, missedStreak: streakById.get(String(r.personId)) || 0 }))
    .sort((a, b) => b.missedStreak - a.missedStreak);
  const registered = roster.people.length;
  const viaQr = attendees.filter((p) => p.source === "public-checkin").length;
  const abnormal = attendees.filter((p) => {
    const r = draftResult(drafts[p.personId] || toDraft(p));
    return r.bpBad || r.pulseBad;
  }).length;

  const q = search.trim().toLowerCase();
  const rows = attendees.filter((p) => {
    if (q && !p.fullName.toLowerCase().includes(q)) return false;
    if (abnormalOnly) {
      const r = draftResult(drafts[p.personId] || toDraft(p));
      if (!r.bpBad && !r.pulseBad) return false;
    }
    return true;
  });

  const saveRow = async (id) => {
    const d = drafts[id];
    const nums = {
      weightKg: parseNumberField(d.weightKg),
      waistCm: parseNumberField(d.waistCm),
      pulseBpm: parseNumberField(d.pulseBpm),
    };
    const b1 = parseBpText(d.bp1);
    const b2 = parseBpText(d.bp2);
    const person = attendees.find((p) => p.personId === id);
    if (Object.values(nums).includes(undefined) || (d.bp1.trim() && b1.sys === null) || (d.bp2.trim() && b2.sys === null)) {
      setRowError(`ค่าของ ${person?.fullName || "แถวนี้"} ไม่ถูกต้อง (ความดันใช้รูปแบบ 120/80)`);
      return false;
    }
    setSavingId(id);
    setRowError("");
    try {
      await postJson("/api/elderly-school/visits", {
        personId: id,
        yearBE,
        visitNo: selectedNo,
        ...nums,
        bp1Sys: b1.sys,
        bp1Dia: b1.dia,
        bp2Sys: b2.sys,
        bp2Dia: b2.dia,
      });
      return true;
    } catch (e) {
      setRowError(e?.message || "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    for (const id of dirtyIds) {
      const ok = await saveRow(id);
      if (!ok) break;
    }
    dash.reload();
  };

  const setField = (id, f, v) => setDrafts((s) => ({ ...s, [id]: { ...s[id], [f]: v } }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">ปี {yearBE} · หลักสูตร 16 ครั้ง</span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">บันทึกการมาเรียน</h2>
        </div>
        <button type="button" className={btnCls} onClick={() => go("schedule")}>
          แก้ตารางวันเรียน
        </button>
      </div>

      <nav aria-label="เลือกครั้งที่" className="flex gap-2 overflow-x-auto pb-1">
        {sched.statuses.map((s) => {
          const on = s.visitNo === selectedNo;
          const sub = s.status === "today" ? "วันนี้" : s.status === "done" ? "เรียนแล้ว" : s.status === "scheduled" ? "ยังไม่ถึง" : "ยังไม่ตั้ง";
          return (
            <button
              key={s.visitNo}
              type="button"
              aria-pressed={on}
              onClick={() => setQuery({ visit: s.visitNo })}
              className={
                "shrink-0 min-w-16 min-h-14 px-2.5 py-1.5 rounded-xl border flex flex-col items-center justify-center " +
                (on
                  ? "bg-[#0E5A55] border-[#0E5A55] text-white"
                  : s.status === "done" || s.status === "today"
                    ? "bg-white border-[#E4E2DA] text-[#1D2421] hover:bg-[#F4F3EE]"
                    : "bg-[#F4F3EE] border-[#E4E2DA] text-[#5B635F] hover:bg-[#ECEAE3]")
              }
            >
              <span className="text-base font-bold">{s.visitNo}</span>
              <span className="text-[11px] font-medium">{sub}</span>
            </button>
          );
        })}
      </nav>

      {!selectedNo ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-5 items-start">
          <section className={cardCls + " flex-[3_1_600px] min-w-0 overflow-hidden"} aria-label={`ผลวัดครั้งที่ ${selectedNo}`}>
            <div className="p-5 flex flex-col gap-3.5 border-b border-[#E4E2DA]">
              <div className="flex flex-wrap justify-between gap-3 items-center">
                <div className="flex flex-col gap-0.5">
                  <h3 className="m-0 text-xl font-bold">
                    ครั้งที่ {selectedNo} · {session?.dateISO ? formatThaiDate(session.dateISO) : "ยังไม่ตั้งวันเรียน"}
                  </h3>
                  {session?.note && <span className="text-sm text-[#5B635F]">{session.note}</span>}
                </div>
                {session?.status === "today" && <Chip tone="care">วันนี้ · เปิดเช็คอิน</Chip>}
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                {[
                  ["มีผลวัดแล้ว", attendees.length, registered ? ` / ${registered}` : "", "ok"],
                  ["เช็คอินเองด้วย QR", viaQr, "", null],
                  ["เจ้าหน้าที่/ชีต", attendees.length - viaQr, "", null],
                  ["ค่าผิดปกติ", abnormal, "", abnormal ? "see" : null],
                ].map(([label, value, suffix, tone]) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: tone ? TONE_STYLES[tone].bg : "#F4F3EE" }}>
                    <span className="block text-xs" style={{ color: tone ? TONE_STYLES[tone].fg : "#4F5652" }}>
                      {label}
                    </span>
                    <span className="text-2xl font-bold" style={{ color: tone ? TONE_STYLES[tone].fg : "#1D2421" }}>
                      {value}
                    </span>
                    <span className="text-[13px]" style={{ color: tone ? TONE_STYLES[tone].fg : "#4F5652" }}>
                      {suffix}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2.5 items-center">
                <input
                  type="search"
                  aria-label="ค้นหาผู้เรียน"
                  placeholder="ค้นหาชื่อ"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputCls + " flex-[1_1_240px] min-w-0"}
                />
                <button type="button" className={filterCls(abnormalOnly)} aria-pressed={abnormalOnly} onClick={() => setAbnormalOnly((v) => !v)}>
                  เฉพาะค่าผิดปกติ
                </button>
              </div>
              {(dash.error || rowError) && <Notice tone="see">{dash.error || rowError}</Notice>}
            </div>

            {dash.loading && !dash.data ? (
              <Spinner />
            ) : rows.length === 0 ? (
              <EmptyState>{attendees.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีผลวัดของครั้งนี้ — บันทึกจากรายชื่อ “ยังไม่มา” ได้เลย"}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#FBFAF7] text-left text-xs font-semibold text-[#5B635F]">
                      {["ผู้เรียน", "ช่องทาง", "น้ำหนัก กก.", "รอบเอว ซม.", "ชีพจร", "ความดันรอบ 1", "ความดันรอบ 2", "ผล", ""].map((h, i) => (
                        <th key={i} className={"py-2.5 px-1.5 border-b border-[#E4E2DA] whitespace-nowrap " + (i === 0 ? "pl-5" : "")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const d = drafts[p.personId] || toDraft(p);
                      const r = draftResult(d);
                      const dirty = isDirty(p.personId);
                      const cell = (f, w, bad, mode = "decimal") => (
                        <input
                          aria-label={f}
                          inputMode={mode}
                          value={d[f]}
                          onChange={(e) => setField(p.personId, f, e.target.value)}
                          className={
                            "min-h-10 px-2 rounded-lg border text-[15px] text-right " +
                            w +
                            (bad ? " border-[#C0473E] bg-[#FDF3F2]" : " border-[#D6D3C8] bg-white")
                          }
                        />
                      );
                      return (
                        <tr key={p.personId} className={dirty ? "bg-[#FFFBF2]" : ""}>
                          <td className="py-2 px-1.5 pl-5 border-b border-[#EFEDE6] font-semibold whitespace-nowrap">{p.fullName}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">
                            <SourceChip source={p.source} />
                          </td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">{cell("weightKg", "w-[66px]")}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">{cell("waistCm", "w-[66px]")}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">{cell("pulseBpm", "w-[60px]", r.pulseBad, "numeric")}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">{cell("bp1", "w-[84px]", r.bpBad, "text")}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">{cell("bp2", "w-[84px]", false, "text")}</td>
                          <td className="py-2 px-1.5 border-b border-[#EFEDE6]">
                            <Chip tone={r.result.tone}>{r.result.label}</Chip>
                          </td>
                          <td className="py-2 px-1.5 pr-4 border-b border-[#EFEDE6] text-right">
                            {dirty && (
                              <button
                                type="button"
                                className={primaryBtnCls + " !min-h-10 !px-3 text-sm"}
                                disabled={savingId === p.personId}
                                onClick={async () => {
                                  if (await saveRow(p.personId)) dash.reload();
                                }}
                              >
                                {savingId === p.personId ? "..." : "บันทึก"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-3.5 bg-[#FBFAF7] border-t border-[#E4E2DA]">
              <span className="text-sm text-[#5B635F]">
                {dirtyIds.length ? `แก้ไขแล้วยังไม่บันทึก ${dirtyIds.length} แถว` : "ข้อมูลตรงกับที่บันทึกไว้"}              </span>
              <div className="flex gap-2">
                <button type="button" className={btnCls} disabled={!dirtyIds.length} onClick={() => setDrafts(original)}>
                  ยกเลิกการแก้ไข
                </button>
                <button type="button" className={primaryBtnCls} disabled={!dirtyIds.length || savingId !== null} onClick={saveAll}>
                  บันทึกทั้งหมด
                </button>
              </div>
            </div>
          </section>

          <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-5">
            <SectionCard title={`ยังไม่มีผลวัด ${absent.length} คน`} bodyClassName="px-5 pb-4 pt-2">
              {roster.loading ? (
                <Spinner />
              ) : absent.length === 0 ? (
                <EmptyState>ครบทุกคนแล้ว</EmptyState>
              ) : (
                <>
                  <ul className="m-0 p-0 list-none">
                    {(showAllAbsent ? absent : absent.slice(0, 8)).map((a) => (
                      <li key={a.personId} className="flex items-center gap-2.5 py-2.5 border-t border-[#EFEDE6] first:border-t-0">
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="text-[15px] font-semibold truncate">{a.fullName || "-"}</span>
                          {a.missedStreak > 0 && (
                            <span className={"text-xs " + (a.missedStreak >= 3 ? "text-[#8E1F18] font-semibold" : "text-[#5B635F]")}>
                              ขาดติดกัน {a.missedStreak} ครั้งก่อนหน้านี้
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className={btnCls + " !min-h-10 !px-3 text-sm"}
                          onClick={() => setEntryFor({ personId: String(a.personId), fullName: a.fullName })}
                        >
                          + บันทึกผลวัด
                        </button>
                      </li>
                    ))}
                  </ul>
                  {absent.length > 8 && (
                    <button type="button" className="mt-2 text-sm font-semibold text-[#0E5A55]" onClick={() => setShowAllAbsent((v) => !v)}>
                      {showAllAbsent ? "ย่อรายการ" : `แสดงทั้งหมด ${absent.length} คน`}
                    </button>
                  )}
                </>
              )}
            </SectionCard>
            <SectionCard title="ผู้เรียนเช็คอินเอง">
              <p className="m-0 text-sm text-[#3C4541] leading-relaxed">
                ผู้เรียนสแกน QR บนบัตรของตัวเอง แล้วยืนยันเลขบัตร 4 ตัวท้าย ระบบบันทึกเป็นครั้งที่ตรงกับวันเรียนวันนั้น
              </p>
              <button type="button" className={btnCls + " mt-3 w-full"} onClick={() => go("cards")}>
                ไปหน้าบัตร QR
              </button>
            </SectionCard>
          </div>
        </div>
      )}

      <VisitEditModal
        open={Boolean(entryFor)}
        onClose={() => setEntryFor(null)}
        onSaved={() => dash.reload()}
        person={entryFor}
        yearBE={yearBE}
        visitNo={selectedNo}
        visit={null}
        dateISO={session?.dateISO}
      />
    </div>
  );
}
