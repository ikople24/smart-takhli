import { useEffect, useState } from "react";
import { todayInBangkok } from "@/lib/garbage/time";

const STEPS = [
  "มัดปากถุงให้แน่น แยกเศษอาหารออกจากขยะแห้ง",
  "วางถังหน้าบ้านก่อนรถถึง 15 นาที",
  "เก็บถังคืนหลังรถผ่าน",
];

/** เช็กลิสต์ก่อนรถมา — จำเฉพาะของวันนี้ (คีย์มีวันที่อยู่ ขึ้นวันใหม่จึงเริ่มใหม่เอง) */
export default function PrepChecklist() {
  // ต้องคิดวันด้วยเวลาไทยเสมอ ไม่ใช่เวลาเครื่อง — คนตั้งโซนเวลาเครื่องผิดจะได้คีย์ของวันอื่น
  const key = "garbage.prep." + todayInBangkok();
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // ปรับความยาวให้ตรงกับ STEPS ปัจจุบัน — ค่าที่ค้างจากตอนรายการยังไม่เท่านี้ต้องไม่ทำให้เพี้ยน
      setDone(STEPS.map((_, i) => parsed[i] === true));
    } catch {
      /* อ่านไม่ได้ก็เริ่มใหม่ ไม่ต้องบอกผู้ใช้ */
    }
  }, [key]);

  const toggle = (i: number) => {
    setDone((prev) => {
      const next = prev.slice();
      next[i] = !next[i];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* โหมดส่วนตัวเขียนไม่ได้ — ติ๊กได้แต่ไม่จำ ดีกว่าพัง */
      }
      return next;
    });
  };

  const count = done.filter(Boolean).length;

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">ก่อนรถมา ทำ {STEPS.length} อย่างนี้</h2>
        <span className="text-[11px] font-semibold text-teal-700">{count}/{STEPS.length}</span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={done[i]}
              className={
                "flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left " +
                (done[i]
                  ? "border-green-200 bg-green-50"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100")
              }
            >
              <span
                aria-hidden
                className={
                  "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-xs " +
                  (done[i] ? "bg-emerald-800 text-white" : "border-2 border-slate-300 text-slate-400")
                }
              >
                {done[i] ? "✓" : i + 1}
              </span>
              <span className={"text-xs " + (done[i] ? "text-emerald-800" : "text-slate-700")}>{label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] text-slate-500">
        {count === STEPS.length ? "พร้อมแล้ว รอรถมาเก็บได้เลย" : "ติ๊กเพื่อจำว่าทำอะไรไปแล้ววันนี้"}
      </p>
    </section>
  );
}
