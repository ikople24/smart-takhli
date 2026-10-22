// แท็บ "ตั้งค่าวันเรียน" — วันที่ครั้งที่ 1–16 ของปี + เวลา/สถานที่/สิ่งที่ควรเตรียม (เดิมหน้า /admin/elderly-schedule)
// มีผลกับหน้าเช็คอินสาธารณะ: ผู้เรียนบันทึกได้เฉพาะวันที่ตั้งไว้ และเห็นตารางเรียนในแท็บ "ตารางเรียน" บนมือถือ
import React, { useEffect, useMemo, useState } from "react";
import { bangkokTodayISO, formatThaiDate, sessionStatuses } from "@/lib/elderly-school/followUp";
import { effectiveSessions, formatTimeRange } from "@/lib/elderly-school/schedule";
import { postJson, useSchedule } from "../useElderlyData";
import { Chip, Notice, Spinner, btnCls, cardCls, inputCls, labelCls, primaryBtnCls } from "../elderlyTheme";

const STATUS_CHIP = {
  done: ["เรียนแล้ว", "none"],
  today: ["วันนี้", "ok"],
  scheduled: ["กำหนดแล้ว", "low"],
  unset: ["ยังไม่ตั้งวัน", "care"],
};

const ROW_FIELDS = ["dateISO", "note", "startTime", "endTime", "prepare", "location"];

function emptySessions() {
  return Array.from({ length: 16 }, (_, i) => {
    const row = { visitNo: i + 1 };
    for (const f of ROW_FIELDS) row[f] = "";
    return row;
  });
}

function fromApi(sessions) {
  const base = emptySessions();
  for (const s of sessions || []) {
    const no = Number(s?.visitNo);
    if (!Number.isFinite(no) || no < 1 || no > 16) continue;
    const row = { visitNo: no };
    for (const f of ROW_FIELDS) row[f] = String(s?.[f] || "");
    base[no - 1] = row;
  }
  return base;
}

function defaultsFromApi(d) {
  return {
    startTime: d?.startTime || "",
    endTime: d?.endTime || "",
    location: d?.location || "",
    contactName: d?.contactName || "",
    contactPhone: d?.contactPhone || "",
  };
}

export default function ScheduleTab({ yearBE }) {
  const sched = useSchedule(yearBE);
  const [rows, setRows] = useState(emptySessions);
  const [defaults, setDefaults] = useState(() => defaultsFromApi(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clearArmed, setClearArmed] = useState(false);

  useEffect(() => {
    setRows(fromApi(sched.sessions));
    setDefaults(defaultsFromApi(sched.data?.schedule?.defaults));
  }, [sched.sessions, sched.data]);

  const statuses = useMemo(() => sessionStatuses(rows, bangkokTodayISO()), [rows]);
  const filled = statuses.filter((s) => s.status !== "unset").length;

  const dupDates = useMemo(() => {
    const seen = new Map();
    for (const r of rows) if (r.dateISO) seen.set(r.dateISO, (seen.get(r.dateISO) || 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([d]) => d));
  }, [rows]);

  // ตัวอย่างที่ผู้เรียนเห็น: ครั้งถัดไป (หรือครั้งแรก) หลังรวมค่าเริ่มต้น
  const preview = useMemo(() => {
    const eff = effectiveSessions({ defaults, sessions: rows });
    const today = bangkokTodayISO();
    return eff.find((s) => s.dateISO >= today) || eff[0] || null;
  }, [defaults, rows]);

  const setRow = (no, patch) => {
    setRows((prev) => prev.map((r) => (r.visitNo === no ? { ...r, ...patch } : r)));
    setSuccess("");
  };

  const save = async () => {
    if (dupDates.size) {
      setError("มีวันที่ซ้ำกัน — แต่ละครั้งต้องเป็นคนละวัน");
      return;
    }
    const phoneDigits = defaults.contactPhone.replace(/\D/g, "");
    if (defaults.contactPhone.trim() && (phoneDigits.length < 9 || phoneDigits.length > 10)) {
      setError("เบอร์โทรเจ้าหน้าที่ต้องเป็นตัวเลข 9–10 หลัก");
      return;
    }
    const badTime = rows.find((r) => r.dateISO && r.startTime && r.endTime && r.endTime <= r.startTime);
    if (badTime || (defaults.startTime && defaults.endTime && defaults.endTime <= defaults.startTime)) {
      setError(`เวลาเลิกต้องหลังเวลาเริ่ม${badTime ? ` (ครั้งที่ ${badTime.visitNo})` : " (ค่าเริ่มต้น)"}`);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = rows
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.dateISO))
        .map((s) => {
          const out = { visitNo: s.visitNo };
          for (const f of ROW_FIELDS) out[f] = s[f] || null;
          return out;
        });
      const json = await postJson(
        `/api/elderly-school/schedule?yearBE=${yearBE}`,
        { yearBE, defaults, sessions: payload },
        "PUT"
      );
      setRows(fromApi(json.schedule?.sessions));
      setDefaults(defaultsFromApi(json.schedule?.defaults));
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

  const smallInput = inputCls + " !min-h-10";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">ใช้ร่วมกันทั้งหน้าเช็คอิน ตารางเรียนบนมือถือ และการนับครั้งที่มาเรียน</span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">ตั้งค่าวันเรียน ปี {yearBE}</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={btnCls + (clearArmed ? " !border-[#C0473E] !text-[#8E1F18]" : "")}
            onClick={clearAll}
            onBlur={() => setClearArmed(false)}
          >
            {clearArmed ? "กดอีกครั้งเพื่อยืนยันล้าง" : "ล้างวันที่ทั้งหมด"}
          </button>
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving || sched.loading}>
            {saving ? "กำลังบันทึก..." : "บันทึกตารางเรียน"}
          </button>
        </div>
      </div>

      {sched.error && <Notice tone="see">{sched.error}</Notice>}
      {error && <Notice tone="see">{error}</Notice>}
      {success && <Notice tone="ok">{success}</Notice>}

      <div className="flex flex-wrap gap-5 items-stretch">
      <section className={cardCls + " flex-[3_1_560px] min-w-0 p-5 flex flex-wrap gap-4 items-end"} aria-label="ค่าเริ่มต้น">
        <span className="basis-full text-base font-bold">
          ค่าเริ่มต้นและผู้ติดต่อของปี <span className="text-[13px] font-medium text-[#5B635F]">ครั้งไหนต่างจากนี้ แก้ในตารางด้านล่าง</span>
        </span>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>เวลาเริ่ม</span>
          <input type="time" className={inputCls} value={defaults.startTime} onChange={(e) => setDefaults((d) => ({ ...d, startTime: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>เวลาเลิก</span>
          <input type="time" className={inputCls} value={defaults.endTime} onChange={(e) => setDefaults((d) => ({ ...d, endTime: e.target.value }))} />
        </label>
        <label className="flex-[1_1_280px] flex flex-col gap-1 min-w-0">
          <span className={labelCls}>สถานที่เรียนประจำ</span>
          <input
            className={inputCls}
            value={defaults.location}
            maxLength={120}
            placeholder="เช่น ศาลาประชาคม ชุมชน..."
            onChange={(e) => setDefaults((d) => ({ ...d, location: e.target.value }))}
          />
        </label>
        <label className="flex-[1_1_220px] flex flex-col gap-1 min-w-0">
          <span className={labelCls}>ชื่อผู้ติดต่อ (แสดงบนมือถือผู้เรียน)</span>
          <input
            className={inputCls}
            value={defaults.contactName}
            maxLength={80}
            placeholder="เช่น ครูประจำโรงเรียนผู้สูงอายุ"
            onChange={(e) => setDefaults((d) => ({ ...d, contactName: e.target.value }))}
          />
        </label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 min-w-0">
          <span className={labelCls}>เบอร์โทรเจ้าหน้าที่</span>
          <input
            className={inputCls}
            type="tel"
            inputMode="tel"
            value={defaults.contactPhone}
            maxLength={20}
            placeholder="0XX-XXX-XXXX"
            onChange={(e) => setDefaults((d) => ({ ...d, contactPhone: e.target.value }))}
          />
        </label>
      </section>
      <section className={cardCls + " flex-[1_1_300px] min-w-0 p-5 flex flex-col gap-3"} aria-label="ตัวอย่างที่ผู้เรียนเห็น">
        <h3 className="m-0 text-base font-bold">ผู้เรียนจะเห็นบนมือถือ</h3>
        {preview ? (
          <div className="p-4 rounded-2xl bg-[#0E5A55] text-white flex flex-col gap-1.5">
            <span className="text-[13px] opacity-90">ครั้งถัดไป · ครั้งที่ {preview.visitNo}</span>
            <span className="text-xl font-bold">{formatThaiDate(preview.dateISO)}</span>
            <span className="text-sm">
              {[formatTimeRange(preview.startTime, preview.endTime), preview.location].filter(Boolean).join(" · ") || "ยังไม่ระบุเวลาและสถานที่"}
            </span>
          </div>
        ) : (
          <span className="text-sm text-[#5B635F]">ยังไม่มีวันเรียน</span>
        )}
        <span className="text-[13px] text-[#5B635F]">
          {defaults.contactPhone.trim()
            ? `ปุ่ม "โทรหาเจ้าหน้าที่" จะโทรไปที่ ${defaults.contactPhone.trim()}`
            : "ยังไม่ได้ตั้งเบอร์ — หน้ามือถือจะไม่แสดงปุ่มโทรหาเจ้าหน้าที่"}
        </span>
      </section>
      </div>

      <div className="flex flex-col gap-3">
        <section className={cardCls + " min-w-0 overflow-hidden"} aria-label="ตารางวันเรียน">
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
                    {["ครั้ง", "วันที่", "เวลา (ว่าง = ค่าเริ่มต้น)", "หัวข้อกิจกรรม", "สิ่งที่ควรเตรียม", "สถานะ"].map((h) => (
                      <th key={h} className="py-2.5 px-1.5 border-b border-[#E4E2DA] whitespace-nowrap first:pl-5">
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
                        <td className="py-1.5 px-1.5 pl-5 border-b border-[#EFEDE6] font-bold">{r.visitNo}</td>
                        <td className="py-1.5 px-1.5 border-b border-[#EFEDE6]">
                          <input
                            type="date"
                            aria-label={`วันที่ครั้งที่ ${r.visitNo}`}
                            value={r.dateISO}
                            onChange={(e) => setRow(r.visitNo, { dateISO: e.target.value })}
                            className={smallInput + " w-[150px]" + (dup ? " !border-[#C0473E] !bg-[#FDF3F2]" : !r.dateISO ? " border-dashed bg-[#FBFAF7]" : "")}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 border-b border-[#EFEDE6] whitespace-nowrap">
                          <input
                            type="time"
                            aria-label={`เวลาเริ่มครั้งที่ ${r.visitNo}`}
                            value={r.startTime}
                            onChange={(e) => setRow(r.visitNo, { startTime: e.target.value })}
                            className={smallInput + " w-[124px]"}
                          />
                          <span className="mx-1 text-[#5B635F]">–</span>
                          <input
                            type="time"
                            aria-label={`เวลาเลิกครั้งที่ ${r.visitNo}`}
                            value={r.endTime}
                            onChange={(e) => setRow(r.visitNo, { endTime: e.target.value })}
                            className={smallInput + " w-[124px]"}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 border-b border-[#EFEDE6]">
                          <input
                            aria-label={`หัวข้อครั้งที่ ${r.visitNo}`}
                            value={r.note}
                            maxLength={200}
                            onChange={(e) => setRow(r.visitNo, { note: e.target.value })}
                            placeholder="เช่น ออกกำลังกาย / ตรวจสุขภาพ"
                            className={smallInput + " w-full min-w-[200px]"}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 border-b border-[#EFEDE6]">
                          <input
                            aria-label={`สิ่งที่ควรเตรียมครั้งที่ ${r.visitNo}`}
                            value={r.prepare}
                            maxLength={300}
                            onChange={(e) => setRow(r.visitNo, { prepare: e.target.value })}
                            placeholder="เช่น ผ้าเช็ดตัว ขวดน้ำ"
                            className={smallInput + " w-full min-w-[170px]"}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 pr-4 border-b border-[#EFEDE6]">
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

      </div>
    </div>
  );
}
