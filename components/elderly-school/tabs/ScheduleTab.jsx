// แท็บ "ตั้งค่าวันเรียน" — วันที่ครั้งที่ 1–16 ของปี (เดิมหน้า /admin/elderly-schedule)
// มีผลกับหน้าเช็คอินสาธารณะ: ผู้เรียนบันทึกได้เฉพาะวันที่ตั้งไว้ และระบบบันทึกเป็นครั้งที่ตรงกับวันนั้น
import React, { useEffect, useMemo, useState } from "react";
import { bangkokTodayISO, sessionStatuses } from "@/lib/elderly-school/followUp";
import { postJson, useSchedule } from "../useElderlyData";
import { Chip, Notice, Spinner, btnCls, cardCls, inputCls, primaryBtnCls } from "../elderlyTheme";

const STATUS_CHIP = {
  done: ["เรียนแล้ว", "none"],
  today: ["วันนี้", "ok"],
  scheduled: ["กำหนดแล้ว", "low"],
  unset: ["ยังไม่ตั้งวัน", "care"],
};

function emptySessions() {
  return Array.from({ length: 16 }, (_, i) => ({ visitNo: i + 1, dateISO: "", note: "" }));
}

function fromApi(sessions) {
  const base = emptySessions();
  for (const s of sessions || []) {
    const no = Number(s?.visitNo);
    if (!Number.isFinite(no) || no < 1 || no > 16) continue;
    base[no - 1] = { visitNo: no, dateISO: String(s?.dateISO || ""), note: String(s?.note || "") };
  }
  return base;
}

export default function ScheduleTab({ yearBE }) {
  const sched = useSchedule(yearBE);
  const [rows, setRows] = useState(emptySessions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clearArmed, setClearArmed] = useState(false);

  useEffect(() => {
    setRows(fromApi(sched.sessions));
  }, [sched.sessions]);

  const statuses = useMemo(() => sessionStatuses(rows, bangkokTodayISO()), [rows]);
  const filled = statuses.filter((s) => s.status !== "unset").length;

  const dupDates = useMemo(() => {
    const seen = new Map();
    for (const r of rows) if (r.dateISO) seen.set(r.dateISO, (seen.get(r.dateISO) || 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([d]) => d));
  }, [rows]);

  const setRow = (no, patch) => {
    setRows((prev) => prev.map((r) => (r.visitNo === no ? { ...r, ...patch } : r)));
    setSuccess("");
  };

  const save = async () => {
    if (dupDates.size) {
      setError("มีวันที่ซ้ำกัน — แต่ละครั้งต้องเป็นคนละวัน");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = rows
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.dateISO))
        .map((s) => ({ visitNo: s.visitNo, dateISO: s.dateISO, note: s.note || null }));
      const json = await postJson(`/api/elderly-school/schedule?yearBE=${yearBE}`, { yearBE, sessions: payload }, "PUT");
      setRows(fromApi(json.schedule?.sessions));
      setSuccess(`บันทึกแล้ว ${payload.length}/16 ครั้ง`);
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    setRows(emptySessions());
    setSuccess("ล้างวันที่แล้ว (ยังไม่บันทึก)");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">ใช้ร่วมกันทั้งหน้าเช็คอินและการนับครั้งที่มาเรียน</span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">ตั้งค่าวันเรียน ปี {yearBE}</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={btnCls + (clearArmed ? " !border-[#C0473E] !text-[#8E1F18]" : "")} onClick={clearAll} onBlur={() => setClearArmed(false)}>
            {clearArmed ? "กดอีกครั้งเพื่อยืนยันล้าง" : "ล้างทั้งหมด"}
          </button>
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving || sched.loading}>
            {saving ? "กำลังบันทึก..." : "บันทึกตารางเรียน"}
          </button>
        </div>
      </div>

      {sched.error && <Notice tone="see">{sched.error}</Notice>}
      {error && <Notice tone="see">{error}</Notice>}
      {success && <Notice tone="ok">{success}</Notice>}

      <div className="flex flex-wrap gap-5 items-start">
        <section className={cardCls + " flex-[3_1_640px] min-w-0 overflow-hidden"} aria-label="ตารางวันเรียน">
          <div className="px-5 py-4 flex flex-wrap justify-between items-center gap-2.5 border-b border-[#E4E2DA]">
            <span className="text-base font-bold">16 ครั้ง · ตั้งวันแล้ว {filled} ครั้ง</span>
            {16 - filled > 0 && <Chip tone="care">ยังไม่ตั้งวัน {16 - filled} ครั้ง</Chip>}
          </div>
          {sched.loading && !sched.data ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FBFAF7] text-left text-xs font-semibold text-[#5B635F]">
                    {["ครั้ง", "วันที่", "หัวข้อกิจกรรม / หมายเหตุ", "สถานะ"].map((h) => (
                      <th key={h} className="py-2.5 px-2 border-b border-[#E4E2DA] whitespace-nowrap first:pl-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = statuses[r.visitNo - 1];
                    const [label, tone] = STATUS_CHIP[st.status];
                    const dup = r.dateISO && dupDates.has(r.dateISO);
                    return (
                      <tr key={r.visitNo} className={st.status === "today" ? "bg-[#F0F7F6]" : ""}>
                        <td className="py-1.5 px-2 pl-5 border-b border-[#EFEDE6] font-bold">{r.visitNo}</td>
                        <td className="py-1.5 px-2 border-b border-[#EFEDE6]">
                          <input
                            type="date"
                            aria-label={`วันที่ครั้งที่ ${r.visitNo}`}
                            value={r.dateISO}
                            onChange={(e) => setRow(r.visitNo, { dateISO: e.target.value })}
                            className={inputCls + " !min-h-10 w-[160px]" + (dup ? " !border-[#C0473E] !bg-[#FDF3F2]" : !r.dateISO ? " border-dashed bg-[#FBFAF7]" : "")}
                          />
                        </td>
                        <td className="py-1.5 px-2 border-b border-[#EFEDE6]">
                          <input
                            aria-label={`หัวข้อครั้งที่ ${r.visitNo}`}
                            value={r.note}
                            onChange={(e) => setRow(r.visitNo, { note: e.target.value })}
                            placeholder="เช่น กิจกรรมออกกำลังกาย / ตรวจสุขภาพ"
                            className={inputCls + " !min-h-10 w-full min-w-[220px]"}
                          />
                        </td>
                        <td className="py-1.5 px-2 pr-4 border-b border-[#EFEDE6]">
                          <Chip tone={dup ? "see" : tone}>{dup ? "วันซ้ำ" : label}</Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={cardCls + " flex-[1_1_300px] min-w-0 p-5 flex flex-col gap-2 text-sm text-[#3C4541]"} aria-label="ข้อควรรู้">
          <h3 className="m-0 text-base font-bold text-[#1D2421]">ข้อควรรู้</h3>
          <p className="m-0">ผู้เรียนเช็คอินได้เฉพาะวันที่ตั้งไว้ และระบบบันทึกเป็นครั้งที่ตรงกับวันนั้น</p>
          <p className="m-0">ครั้งที่ยังไม่ตั้งวัน ผู้เรียนจะเช็คอินด้วยตัวเองไม่ได้ (เจ้าหน้าที่ยังบันทึกผลวัดในแท็บการมาเรียนได้)</p>
          <p className="m-0">แต่ละครั้งต้องเป็นคนละวัน</p>
        </section>
      </div>
    </div>
  );
}
