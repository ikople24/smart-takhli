// แท็บ "คัดกรอง 2Q" — รายชื่อที่ต้องคัดกรอง + แบบประเมิน 2Q ในหน้าเดียว (ไม่มี 9Q ในหน้าจอนี้)
import React, { useEffect, useMemo, useState } from "react";
import { bangkokTodayISO, formatThaiDate, mhChip } from "@/lib/elderly-school/followUp";
import { fetchJson, mergeRoster, postJson, useDashboard, useRoster } from "../useElderlyData";
import {
  Chip,
  EmptyState,
  Notice,
  Spinner,
  StatTile,
  ProgressBar,
  btnCls,
  cardCls,
  filterCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "../elderlyTheme";

const QUESTIONS = [
  ["q1", "รู้สึกซึมเศร้า หดหู่ หรือหมดหวัง"],
  ["q2", "รู้สึกเบื่อ ไม่สนใจ หรือไม่อยากทำอะไร"],
];

const FILTERS = [
  { key: "todo", label: "ยังไม่คัดกรอง", test: (r) => !r.mh },
  { key: "positive", label: "2Q บวก", test: (r) => r.mh?.q2Positive === true },
  { key: "all", label: "ทั้งหมด", test: () => true },
];

function q1(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default function ScreeningTab({ yearBE, query, setQuery }) {
  const dash = useDashboard(yearBE, "latest");
  const roster = useRoster(yearBE);
  const filterKey = FILTERS.some((f) => f.key === q1(query.list)) ? q1(query.list) : "todo";
  const selectedId = q1(query.person) || null;

  const rows = useMemo(
    () => mergeRoster(roster.people, dash.data?.people, dash.data?.mentalHealthOthers),
    [roster.people, dash.data]
  );
  const registered = rows.length;
  const screened = rows.filter((r) => r.mh).length;
  const positive = rows.filter((r) => r.mh?.q2Positive).length;
  const list = rows.filter((FILTERS.find((f) => f.key === filterKey) || FILTERS[0]).test);
  const selected = rows.find((r) => r.personId === selectedId) || null;

  const [answers, setAnswers] = useState({ q1: null, q2: null });
  const [dateISO, setDateISO] = useState(bangkokTodayISO());
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setAnswers({ q1: null, q2: null });
    setNote("");
    setError("");
    setSaved("");
    setDateISO(bangkokTodayISO());
    setHistory([]);
    if (!selectedId) return;
    let alive = true;
    fetchJson(`/api/elderly-school/assessments?personId=${encodeURIComponent(selectedId)}&yearBE=${yearBE}&limit=10`)
      .then((j) => alive && setHistory(Array.isArray(j.items) ? j.items : []))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [selectedId, yearBE]);

  const complete = answers.q1 !== null && answers.q2 !== null;
  const isPositive = answers.q1 === true || answers.q2 === true;
  const yesCount = [answers.q1, answers.q2].filter((v) => v === true).length;

  const save = async (goNext) => {
    if (!selected || !complete) return;
    setSaving(true);
    setError("");
    try {
      await postJson("/api/elderly-school/assessments", {
        personId: selected.personId,
        yearBE,
        assessmentDate: dateISO,
        q2: { q1: answers.q1, q2: answers.q2 },
        q9: null,
        note: note.trim() || null,
      });
      dash.reload();
      setSaved(`บันทึกผลของ ${selected.fullName} แล้ว`);
      if (goNext) {
        // คนถัดไปในรายการเดียวกัน (ข้ามคนปัจจุบัน)
        const idx = list.findIndex((r) => r.personId === selected.personId);
        const next = list.slice(idx + 1).find((r) => r.personId !== selected.personId) || list.find((r) => r.personId !== selected.personId);
        setQuery({ person: next ? next.personId : null });
      } else {
        const j = await fetchJson(`/api/elderly-school/assessments?personId=${encodeURIComponent(selected.personId)}&yearBE=${yearBE}&limit=10`);
        setHistory(Array.isArray(j.items) ? j.items : []);
      }
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const loading = (dash.loading && !dash.data) || (roster.loading && !roster.data);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-[#5B635F]">ปี {yearBE} · แบบคัดกรอง 2Q</span>
        <h2 className="m-0 text-[26px] font-bold leading-tight">คัดกรองสุขภาพจิต</h2>
      </div>

      <section aria-label="สรุป" className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatTile label="คัดกรองแล้วปีนี้" value={screened} unit={`/ ${registered} คน`}>
          <ProgressBar value={screened} max={registered} />
        </StatTile>
        <StatTile label="2Q ปกติ" value={screened - positive} unit="คน" tone="ok" />
        <StatTile label="2Q บวก · ต้องติดตาม" value={positive} unit="คน" tone={positive ? "mind" : undefined} />
        <StatTile label="ยังไม่คัดกรอง" value={registered - screened} unit="คน" tone={registered - screened ? "care" : undefined} />
      </section>

      {(dash.error || roster.error) && <Notice tone="see">{dash.error || roster.error}</Notice>}

      <div className="flex flex-wrap gap-5 items-start">
        <section className={cardCls + " flex-[2_1_380px] min-w-0 p-5 flex flex-col gap-3"} aria-label="รายชื่อ">
          <div role="group" aria-label="กรอง" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filterKey === f.key}
                className={filterCls(filterKey === f.key)}
                onClick={() => setQuery({ list: f.key === "todo" ? null : f.key })}
              >
                {f.label} {rows.filter(f.test).length}
              </button>
            ))}
          </div>
          {loading ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState>{filterKey === "todo" ? "คัดกรองครบทุกคนแล้ว" : "ไม่มีรายชื่อ"}</EmptyState>
          ) : (
            <ul className="m-0 p-0 list-none max-h-[560px] overflow-y-auto">
              {list.map((r) => {
                const chip = mhChip(r.mh);
                const on = r.personId === selectedId;
                return (
                  <li key={r.personId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setQuery({ person: r.personId })}
                      className={
                        "w-full flex items-center gap-3 py-3 px-2.5 border-t border-[#EFEDE6] rounded-[10px] text-left " +
                        (on ? "bg-[#F0F7F6]" : "hover:bg-[#FBFAF7]")
                      }
                    >
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold truncate">{r.fullName || "-"}</span>
                        <span className="text-[13px] text-[#5B635F]">
                          {r.mh?.assessmentDate ? `ประเมินล่าสุด ${formatThaiDate(r.mh.assessmentDate)}` : "ยังไม่เคยประเมินปีนี้"}
                        </span>
                      </span>
                      <Chip tone={chip.tone}>{chip.label}</Chip>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={cardCls + " flex-[3_1_560px] min-w-0 overflow-hidden"} aria-label="แบบประเมิน">
          {!selected ? (
            <div className="p-6">
              <EmptyState>เลือกชื่อทางซ้ายเพื่อเริ่มประเมิน</EmptyState>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-[#E4E2DA] flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className={labelCls}>กำลังประเมิน</span>
                  <span className="text-xl font-bold">{selected.fullName}</span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>วันที่ประเมิน</span>
                  <input type="date" className={inputCls} value={dateISO} max={bangkokTodayISO()} onChange={(e) => setDateISO(e.target.value)} />
                </label>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <h3 className="m-0 text-[17px] font-bold">
                  แบบคัดกรอง 2Q <span className="text-sm font-medium text-[#5B635F]">ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้</span>
                </h3>
                {QUESTIONS.map(([k, text], i) => (
                  <div key={k} className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-[#FBFAF7]">
                    <span className="flex-[1_1_260px] text-base">
                      {i + 1}. {text}
                    </span>
                    <div role="group" aria-label={`คำตอบข้อ ${i + 1}`} className="grid grid-cols-2 gap-2">
                      {[
                        [true, "ใช่"],
                        [false, "ไม่ใช่"],
                      ].map(([v, label]) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={answers[k] === v}
                          onClick={() => setAnswers((s) => ({ ...s, [k]: v }))}
                          className={
                            "w-24 min-h-12 rounded-xl border text-base font-semibold " +
                            (answers[k] === v ? "bg-[#0E5A55] border-[#0E5A55] text-white" : "bg-white border-[#D6D3C8] text-[#3C4541] hover:bg-[#F4F3EE]")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {complete && (
                  <Notice tone={isPositive ? "mind" : "ok"}>
                    {isPositive
                      ? `ผล 2Q บวก (ตอบ “ใช่” ${yesCount} ข้อ) · จะอยู่ในรายชื่อที่ต้องติดตาม`
                      : "ผล 2Q ปกติ (ตอบ “ไม่ใช่” ทั้ง 2 ข้อ)"}
                  </Notice>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>บันทึกเพิ่มเติม (เห็นเฉพาะเจ้าหน้าที่) เช่น แจ้งเจ้าหน้าที่สาธารณสุขแล้ว</span>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-[#D6D3C8] text-[15px] resize-y focus:outline-none focus:ring-2 focus:ring-[#0E5A55]/30"
                  />
                </label>
                {error && <Notice tone="see">{error}</Notice>}
                {saved && <Notice tone="ok">{saved}</Notice>}
                {history.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold">ประวัติการประเมิน ({history.length})</summary>
                    <ul className="mt-2 mb-0 pl-0 list-none flex flex-col gap-1.5">
                      {history.map((h) => (
                        <li key={String(h._id || h.assessmentDate)} className="flex justify-between gap-3 py-1.5 border-b border-[#EFEDE6]">
                          <span>{formatThaiDate(h.assessmentDate) || h.assessmentDate}</span>
                          <Chip tone={h?.q2?.positive ? "mind" : "ok"}>{h?.q2?.positive ? "2Q บวก" : "ปกติ"}</Chip>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-3.5 bg-[#FBFAF7] border-t border-[#E4E2DA]">
                <span className="text-[13px] text-[#5B635F]">เป็นเครื่องมือคัดกรอง ไม่ใช่การวินิจฉัย · ประเมินซ้ำวันเดียวกันจะแทนผลเดิม</span>
                <div className="flex gap-2">
                  <button type="button" className={btnCls} disabled={!complete || saving} onClick={() => save(true)}>
                    บันทึกและคนถัดไป
                  </button>
                  <button type="button" className={primaryBtnCls} disabled={!complete || saving} onClick={() => save(false)}>
                    {saving ? "กำลังบันทึก..." : "บันทึกผล"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
