// แท็บ "นำเข้าข้อมูล" (เฉพาะ superadmin เหมือนเดิม) — ตรวจตัวอย่างก่อน แล้วค่อยนำเข้าจริง
// การนำเข้าอัปเดตเฉพาะช่องที่ชีตมีค่า ไม่ล้างค่าที่แก้ในระบบหรือจากเช็คอิน (ดู pages/api/elderly-school/import.js)
import React, { useState } from "react";
import { postJson } from "../useElderlyData";
import { Notice, StatTile, btnCls, cardCls, inputCls, labelCls, maskCitizen, primaryBtnCls } from "../elderlyTheme";

function Step({ no, label, state }) {
  const done = state === "done";
  const on = state === "on";
  return (
    <li
      className={
        "flex items-center gap-2.5 px-3.5 py-3 rounded-xl border " +
        (on ? "bg-[#E3F0EE] border-2 border-[#0E5A55]" : "bg-white border-[#E4E2DA]")
      }
    >
      <span
        className={
          "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold " +
          (done || on ? "bg-[#0E5A55] text-white" : "bg-[#ECEAE3] text-[#3C4541]")
        }
      >
        {done ? "✓" : no}
      </span>
      <span className={"text-[15px] font-semibold " + (on ? "text-[#0E5A55]" : done ? "" : "text-[#5B635F]")}>{label}</span>
    </li>
  );
}

export default function ImportTab({ yearBE, isSuperAdmin }) {
  const [csvUrl, setCsvUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  if (!isSuperAdmin) {
    return <Notice tone="care">การนำเข้าข้อมูลใช้ได้เฉพาะ superadmin</Notice>;
  }

  const step = result ? 3 : preview ? 2 : 1;

  const run = async (dryRun) => {
    setBusy(true);
    setError("");
    try {
      const json = await postJson("/api/elderly-school/import", { yearBE, csvUrl: csvUrl.trim(), dryRun });
      if (dryRun) {
        setPreview(json);
        setResult(null);
      } else {
        setResult(json);
      }
    } catch (e) {
      setError(e?.message || (dryRun ? "ตรวจตัวอย่างไม่สำเร็จ" : "นำเข้าไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const t = (result || preview)?.totals || {};

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-[#5B635F]">ดึงข้อมูลผู้เรียนและผลวัดรายครั้งจากชีตรายปี</span>
        <h2 className="m-0 text-[26px] font-bold leading-tight">นำเข้าจาก Google Sheet</h2>
      </div>

      <ol aria-label="ขั้นตอน" className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Step no={1} label="วางลิงก์ชีต" state={step > 1 ? "done" : "on"} />
        <Step no={2} label="ตรวจตัวอย่าง" state={step > 2 ? "done" : step === 2 ? "on" : ""} />
        <Step no={3} label="นำเข้าแล้ว" state={step === 3 ? "done" : ""} />
      </ol>

      <section className={cardCls + " p-5 flex flex-wrap gap-3.5 items-end"} aria-label="แหล่งข้อมูล">
        <div className="flex flex-col gap-1">
          <span className={labelCls}>ปีข้อมูล</span>
          <span className="min-h-11 px-3 flex items-center rounded-xl bg-[#F4F3EE] text-[15px] font-semibold">พ.ศ. {yearBE}</span>
        </div>
        <label className="flex-[1_1_420px] flex flex-col gap-1 min-w-0">
          <span className={labelCls}>ลิงก์ CSV ที่ Publish แล้ว (output=csv)</span>
          <input
            className={inputCls}
            value={csvUrl}
            onChange={(e) => {
              setCsvUrl(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
          />
        </label>
        <button type="button" className={btnCls} disabled={busy || !csvUrl.trim()} onClick={() => run(true)}>
          {busy && !preview ? "กำลังตรวจ..." : preview ? "ตรวจอีกครั้ง" : "ตรวจตัวอย่าง"}
        </button>
      </section>

      {error && (
        <Notice tone="see">
          {error} — ตรวจว่าลิงก์เป็น CSV จริง (output=csv) และเลือกปีถูกต้อง
        </Notice>
      )}

      {(preview || result) && (
        <>
          <section aria-label="ผลการตรวจ" className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatTile label="แถวในชีต" value={t.rows ?? 0} unit="แถว" />
            <StatTile label="ผู้เรียนที่อ่านได้" value={t.uniquePeople ?? 0} unit="คน" tone="ok" />
            <StatTile label="ผลวัดรายครั้ง" value={t.visitsParsed ?? 0} unit="รายการ" />
            <StatTile label="แถวที่ข้าม" value={t.peopleSkipped ?? 0} unit="แถว" tone={t.peopleSkipped ? "care" : undefined} sub="ไม่มีเลขบัตร/ชื่อ" />
          </section>

          <div className="flex flex-wrap gap-5 items-start">
            <section className={cardCls + " flex-[3_1_560px] min-w-0 overflow-hidden"} aria-label="ตัวอย่างข้อมูล">
              <div className="px-5 py-4 border-b border-[#E4E2DA] text-base font-bold">ตัวอย่าง {preview?.preview?.length ?? 0} แถวแรก</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#FBFAF7] text-left text-xs font-semibold text-[#5B635F]">
                      {["ชื่อ-นามสกุล", "เลขบัตร", "ส่วนสูง", "จำนวนครั้งที่มีผลวัด"].map((h) => (
                        <th key={h} className="py-2.5 px-3 border-b border-[#E4E2DA] whitespace-nowrap first:pl-5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview?.preview || []).map((r) => (
                      <tr key={r.citizenId}>
                        <td className="py-2.5 px-3 pl-5 border-b border-[#EFEDE6] font-semibold">{r.fullName || "-"}</td>
                        <td className="py-2.5 px-3 border-b border-[#EFEDE6]">{maskCitizen(r.citizenId)}</td>
                        <td className="py-2.5 px-3 border-b border-[#EFEDE6]">{r.heightCm ?? "—"}</td>
                        <td className="py-2.5 px-3 border-b border-[#EFEDE6]">{r.visitsCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={cardCls + " flex-[1_1_300px] min-w-0 p-5 flex flex-col gap-3"} aria-label="ยืนยัน">
              {result ? (
                <Notice tone="ok">
                  นำเข้าแล้ว: ผู้เรียน {result.totals?.peopleUpserted ?? 0} คน · ผลวัด {result.totals?.visitsUpserted ?? 0} รายการ
                </Notice>
              ) : (
                <>
                  <span className="text-sm text-[#3C4541]">
                    นำเข้า {t.uniquePeople ?? 0} คน ข้าม {t.peopleSkipped ?? 0} แถว · ค่าที่แก้ในระบบหรือจากเช็คอินจะไม่ถูกล้าง (อัปเดตเฉพาะช่องที่ชีตมีค่า)
                  </span>
                  <button type="button" className={primaryBtnCls + " w-full !min-h-[52px]"} disabled={busy} onClick={() => run(false)}>
                    {busy ? "กำลังนำเข้า..." : `นำเข้าปี ${yearBE}`}
                  </button>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
