// "สรุปสำหรับแพทย์" — ประวัติผลวัดทุกปีของผู้เรียน 1 คน บนกระดาษ A4 (พิมพ์ หรือบันทึกเป็น PDF จากหน้าต่างพิมพ์)
// เปิดจากแผงประวัติรายคน · ทุกครั้งที่เปิด API จะลงบันทึกผู้เปิดใน elderly_access_logs (PDPA)
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { bangkokTodayISO, formatThaiDate } from "@/lib/elderly-school/followUp";
import { fetchJson } from "./useElderlyData";
import { ElderlyModal, Notice, Spinner, btnCls, primaryBtnCls } from "./elderlyTheme";

// พิมพ์เฉพาะแผ่นสรุป: ตอนพิมพ์ซ่อนทุกอย่างใต้ body ยกเว้น #elderly-doctor-print (portal ระดับ body — ไม่ติด overflow ของ modal)
const PRINT_CSS = `
#elderly-doctor-print { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  body.elderly-doctor-printing > *:not(#elderly-doctor-print) { display: none !important; }
  body.elderly-doctor-printing #elderly-doctor-print { display: block !important; }
}
`;

const BP_BG = { ok: "#E3F0EE", care: "#FBF0D9", see: "#F8E1DD", none: "transparent" };
const th = "border border-[#B9B5A8] px-1.5 py-1 text-left font-semibold bg-[#F4F3EE]";
const td = "border border-[#B9B5A8] px-1.5 py-1";

function Sheet({ data }) {
  const { person, history, bpByYear, mentalHealthByYear } = data;
  const latest = history.years[0]?.rows[0] || null;
  return (
    <div className="text-[12px] leading-snug text-black bg-white [print-color-adjust:exact]">
      <div className="flex justify-between items-start border-b-2 border-black pb-1.5 mb-2">
        <div>
          <div className="text-[17px] font-bold">สรุปผลคัดกรองสุขภาพ (สำหรับแพทย์)</div>
          <div>โรงเรียนผู้สูงอายุ เทศบาลเมืองตาคลี</div>
        </div>
        <div className="text-right">
          <div>พิมพ์เมื่อ {formatThaiDate(bangkokTodayISO())}</div>
          <div>
            ข้อมูลปี {history.firstYear}
            {history.lastYear !== history.firstYear ? `–${history.lastYear}` : ""} · {history.totalVisits} ครั้ง
          </div>
        </div>
      </div>

      <table className="w-full border-collapse mb-2">
        <tbody>
          <tr>
            <td className={td + " w-1/2"}>
              <b>ชื่อ-นามสกุล</b> {person.fullName}
            </td>
            <td className={td}>
              <b>เลขบัตร</b> •••• {person.citizenLast4 || "—"}
            </td>
          </tr>
          <tr>
            <td className={td}>
              <b>อายุ</b> {person.ageYears ?? "—"} ปี {person.birthDateText ? `(เกิด ${person.birthDateText})` : ""}
            </td>
            <td className={td}>
              <b>กรุ๊ปเลือด</b> {person.bloodType || "—"} · <b>ส่วนสูง</b> {person.heightCm ?? "—"} ซม.
            </td>
          </tr>
          <tr>
            <td className={td}>
              <b>โทร</b> {person.phone || "—"}
            </td>
            <td className={td}>
              <b>ที่อยู่</b> {person.address || "—"}
            </td>
          </tr>
        </tbody>
      </table>

      {latest && (
        <div className="mb-2 p-1.5 border border-black">
          <b>ค่าล่าสุด</b> (ปี {latest.yearBE} ครั้งที่ {latest.visitNo}
          {latest.dateISO ? ` · ${formatThaiDate(latest.dateISO)}` : ""}): ความดัน <b>{latest.bp || "—"}</b> มม.ปรอท · ชีพจร{" "}
          <b>{latest.pulseBpm ?? "—"}</b> ครั้ง/นาที · น้ำหนัก <b>{latest.weightKg ?? "—"}</b> กก. · BMI <b>{latest.bmi ?? "—"}</b> · รอบเอว{" "}
          <b>{latest.waistCm ?? "—"}</b> ซม.
        </div>
      )}

      <div className="font-bold mb-1">สรุปรายปี</div>
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            {["ปี", "วัดความดัน", "ค่าเฉลี่ยตัวบน", "ครั้งที่สูง ≥140/90", "2Q ล่าสุด"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bpByYear.map((y) => {
            const mh = mentalHealthByYear?.[y.yearBE];
            return (
              <tr key={y.yearBE}>
                <td className={td}>{y.yearBE}</td>
                <td className={td}>{y.measured} ครั้ง</td>
                <td className={td}>{y.avgSys ?? "—"}</td>
                <td className={td}>{y.highCount} ครั้ง</td>
                <td className={td}>{mh ? `${mh.positive ? "บวก" : "ปกติ"} (${formatThaiDate(mh.date)})` : "ไม่ได้คัดกรอง"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="font-bold mb-1">ผลวัดทุกครั้ง (ใหม่ → เก่า)</div>
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            {["ปี/ครั้ง", "วันที่", "ความดัน", "ชีพจร", "น้ำหนัก (กก.)", "BMI", "รอบเอว (ซม.)"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.years.flatMap((y) =>
            y.rows.map((r) => (
              <tr key={`${y.yearBE}-${r.visitNo}`} className="break-inside-avoid">
                <td className={td + " whitespace-nowrap"}>
                  {y.yearBE}/{r.visitNo}
                </td>
                <td className={td + " whitespace-nowrap"}>{r.dateISO ? formatThaiDate(r.dateISO) : "—"}</td>
                <td className={td + " font-semibold"} style={{ background: BP_BG[r.bpTone] }}>
                  {r.bp || "—"}
                </td>
                <td className={td}>{r.pulseBpm ?? "—"}</td>
                <td className={td}>{r.weightKg ?? "—"}</td>
                <td className={td}>{r.bmi ?? "—"}</td>
                <td className={td}>{r.waistCm ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="text-[11px] text-[#333]">
        หมายเหตุ: ข้อมูลจากการคัดกรองโดยเจ้าหน้าที่/ผู้เรียนวัดเองที่โรงเรียนผู้สูงอายุ ไม่ใช่เวชระเบียน · ความดันใช้ค่ารอบที่ 1 (ไม่มีใช้รอบที่ 2) ·
        สีพื้นความดัน: เขียว = ปกติ, เหลือง = สูงเล็กน้อย, แดง = สูง (≥140/90) หรือต่ำ (&lt;90/60)
      </div>
      <div className="mt-4 flex justify-between text-[12px]">
        <span>ผู้ส่งต่อข้อมูล ........................................</span>
        <span>โทร ..............................</span>
      </div>
    </div>
  );
}

export default function DoctorSummaryModal({ open, onClose, personId }) {
  const [state, setState] = useState({ loading: false, error: "", data: null });

  useEffect(() => {
    if (!open || !personId) return undefined;
    let alive = true;
    setState({ loading: true, error: "", data: null });
    fetchJson(`/api/elderly-school/history?personId=${encodeURIComponent(personId)}`)
      .then((json) => alive && setState({ loading: false, error: "", data: json }))
      .catch((e) => alive && setState({ loading: false, error: e?.message || "โหลดประวัติไม่สำเร็จ", data: null }));
    return () => {
      alive = false;
    };
  }, [open, personId]);

  // ใส่ class ให้ body เฉพาะตอนพิมพ์ — กันชนกับ CSS พิมพ์บัตร QR
  useEffect(() => {
    if (!open) return undefined;
    const after = () => document.body.classList.remove("elderly-doctor-printing");
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("afterprint", after);
      after();
    };
  }, [open]);

  const print = () => {
    document.body.classList.add("elderly-doctor-printing");
    window.print();
  };

  const ready = Boolean(state.data?.history?.totalVisits);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <ElderlyModal
        open={open}
        onClose={onClose}
        size="max-w-3xl"
        title="สรุปสำหรับแพทย์"
        subtitle="ประวัติผลวัดทุกปี · พิมพ์ หรือเลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์เพื่อส่งต่อ · ระบบบันทึกว่าใครเปิดเอกสารนี้"
        footer={
          <>
            <button type="button" className={btnCls} onClick={onClose}>
              ปิด
            </button>
            <button type="button" className={primaryBtnCls} onClick={print} disabled={!ready}>
              พิมพ์ / บันทึก PDF
            </button>
          </>
        }
      >
        {state.loading ? (
          <Spinner />
        ) : state.error ? (
          <Notice tone="see">{state.error}</Notice>
        ) : !ready ? (
          <Notice tone="none">ยังไม่มีผลวัดของผู้เรียนคนนี้</Notice>
        ) : (
          <div className="p-4 border border-[#E4E2DA] rounded-xl overflow-x-auto">
            <Sheet data={state.data} />
          </div>
        )}
      </ElderlyModal>
      {open && ready && typeof document !== "undefined"
        ? createPortal(
            <div id="elderly-doctor-print">
              <Sheet data={state.data} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
