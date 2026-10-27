// แท็บ "บัตร QR" — พิมพ์บัตรเช็คอินรายคน (เดิมหน้า /admin/elderly-cards)
// ลิงก์บนบัตรชี้ /elderly/checkin (ห้ามเปลี่ยน path) — ผู้เรียนยืนยันเลขบัตร 4 ตัวท้ายก่อนบันทึก
import React, { useMemo, useState } from "react";
import { scheduleContact } from "@/lib/elderly-school/schedule";
import { useRoster, useSchedule } from "../useElderlyData";
import { makeCheckinUrl, siteOrigin } from "../QrCheckinModal";
import { EmptyState, Notice, Spinner, btnCls, cardCls, filterCls, inputCls, primaryBtnCls } from "../elderlyTheme";

// พิมพ์เฉพาะพื้นที่บัตร (ซ่อน sidebar/แท็บของแอดมิน)
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 10mm; }
  body * { visibility: hidden !important; }
  #elderly-card-sheet, #elderly-card-sheet * { visibility: visible !important; }
  #elderly-card-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; border: 0 !important; }
}
`;

export default function CardsTab({ yearBE, isSuperAdmin }) {
  const roster = useRoster(yearBE);
  const sched = useSchedule(yearBE);
  const contact = scheduleContact(sched.data?.schedule);
  const [showPhone, setShowPhone] = useState(true);
  const [mode, setMode] = useState("all"); // all | pick
  const [picked, setPicked] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [qrMap, setQrMap] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const people = roster.people;
  const chosen = useMemo(
    () => (mode === "all" ? people : people.filter((p) => picked.has(String(p.personId)))),
    [mode, people, picked]
  );
  const ready = chosen.length > 0 && chosen.every((p) => qrMap[p.personId]);
  const q = search.trim().toLowerCase();

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const QRCode = (await import("qrcode")).default;
      const origin = siteOrigin();
      const entries = await Promise.all(
        chosen.map(async (p) => [
          p.personId,
          await QRCode.toDataURL(makeCheckinUrl(origin, p.personId, yearBE, p.fullName), { margin: 1, width: 400 }),
        ])
      );
      setQrMap((m) => ({ ...m, ...Object.fromEntries(entries) }));
    } catch (e) {
      setError(e?.message || "สร้าง QR ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[#5B635F]">บัตรประจำตัวผู้เรียน ใช้สแกนเช็คอินด้วยตัวเอง</span>
          <h2 className="m-0 text-[26px] font-bold leading-tight">พิมพ์บัตร QR ปี {yearBE}</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={btnCls} onClick={generate} disabled={busy || chosen.length === 0}>
            {busy ? "กำลังสร้าง..." : `สร้าง QR ${chosen.length} ใบ`}
          </button>
          <button type="button" className={primaryBtnCls} onClick={() => window.print()} disabled={!ready}>
            พิมพ์ {chosen.length} ใบ
          </button>
        </div>
      </div>

      {!isSuperAdmin && (
        <Notice tone="care" className="print:hidden">
          หน้านี้แนะนำให้ใช้เฉพาะ superadmin — ลิงก์บนบัตรเป็นแบบสาธารณะ
        </Notice>
      )}
      {(error || roster.error) && <Notice tone="see">{error || roster.error}</Notice>}

      <div className="flex flex-wrap gap-5 items-start">
        <section className={cardCls + " flex-[1_1_320px] min-w-0 p-5 flex flex-col gap-4 print:hidden"} aria-label="เลือกผู้เรียน">
          <div role="group" aria-label="พิมพ์ให้ใคร" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={mode === "all"} className={filterCls(mode === "all")} onClick={() => setMode("all")}>
              ทั้งหมด {people.length} คน
            </button>
            <button type="button" aria-pressed={mode === "pick"} className={filterCls(mode === "pick")} onClick={() => setMode("pick")}>
              เลือกเอง {picked.size ? `(${picked.size})` : ""}
            </button>
          </div>
          {mode === "pick" && (
            <>
              <input type="search" aria-label="ค้นหา" placeholder="ค้นหาชื่อ" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
              <ul className="m-0 p-0 list-none max-h-[420px] overflow-y-auto">
                {people
                  .filter((p) => !q || String(p.fullName).toLowerCase().includes(q))
                  .map((p) => (
                    <li key={p.personId}>
                      <label className="flex items-center gap-3 min-h-11 px-1 border-t border-[#EFEDE6] cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-[#0E5A55]"
                          checked={picked.has(String(p.personId))}
                          onChange={() => toggle(String(p.personId))}
                        />
                        <span className="text-[15px]">{p.fullName || "-"}</span>
                      </label>
                    </li>
                  ))}
              </ul>
            </>
          )}
          <label className="flex items-start gap-3 min-h-11 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 mt-0.5 accent-[#0E5A55]"
              checked={showPhone && Boolean(contact)}
              disabled={!contact}
              onChange={(e) => setShowPhone(e.target.checked)}
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">พิมพ์เบอร์ติดต่อเจ้าหน้าที่บนบัตร</span>
              <span className="text-[13px] text-[#5B635F]">
                {contact ? contact.phone : "ยังไม่ได้ตั้งเบอร์ — ตั้งได้ที่แท็บตั้งค่าวันเรียน"}
              </span>
            </span>
          </label>
          <div className="p-3.5 rounded-xl bg-[#F4F3EE] text-[13px] text-[#3C4541] flex flex-col gap-1">
            <span className="font-bold">วิธีใช้</span>
            <span>1. กด “สร้าง QR” 2. กด “พิมพ์” (กระดาษ A4 ได้ 8 ใบ) 3. ตัดตามเส้นประ</span>
            <span>บัตรแสดงเลขบัตร 4 ตัวท้ายเหมือนบัตรเดิม เพื่อช่วยผู้เรียนจำรหัสยืนยัน</span>
          </div>
        </section>

        <section
          id="elderly-card-sheet"
          aria-label="ตัวอย่างบัตร"
          className={cardCls + " flex-[2_1_560px] min-w-0 p-5"}
        >
          {roster.loading && !roster.data ? (
            <Spinner />
          ) : chosen.length === 0 ? (
            <EmptyState>{people.length ? "ยังไม่ได้เลือกผู้เรียน" : "ไม่พบรายชื่อสำหรับปีนี้ (ต้องมีข้อมูลในปีนั้นก่อน)"}</EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 print:grid-cols-2 print:gap-[6mm]">
              {chosen.map((p) => (
                <div
                  key={p.personId}
                  className="border border-dashed border-[#B9B5A8] rounded-[10px] overflow-hidden flex flex-col break-inside-avoid print:h-[54mm]"
                >
                  <div className="px-2.5 py-1.5 bg-[#0E5A55] text-white text-[11px] font-semibold flex justify-between [print-color-adjust:exact]">
                    <span>โรงเรียนผู้สูงอายุ เทศบาลเมืองตาคลี</span>
                    <span>ปี {yearBE}</span>
                  </div>
                  <div className="flex-1 flex gap-3 p-2.5 items-center">
                    <div className="w-[124px] h-[124px] print:w-[38mm] print:h-[38mm] shrink-0 border border-[#1D2421] rounded flex items-center justify-center overflow-hidden">
                      {qrMap[p.personId] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrMap[p.personId]} alt={`QR ${p.fullName}`} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-[#5B635F] text-center px-1">กด “สร้าง QR”</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[15px] font-bold leading-snug">{p.fullName || "-"}</span>
                      <span className="text-sm font-mono tracking-widest text-[#3C4541]">
                        {p.citizenId ? String(p.citizenId).replace(/\D/g, "").slice(-4) : "????"}
                      </span>
                      <span className="text-[11px] text-[#3C4541] mt-1">สแกนเพื่อเช็คอินและดูผลสุขภาพ</span>
                      {showPhone && contact && <span className="text-[11px] font-semibold text-[#1D2421]">ติดต่อเจ้าหน้าที่ {contact.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
