// ตัวเลือกเดือนแบบตาราง 12 เดือน (ชื่อเดือนไทย + พ.ศ.) — แทน <input type="month"> ที่แสดงตามภาษาเครื่อง
// value / max = "YYYY-MM" (ค.ศ.) · เดือนหลัง max กดไม่ได้
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const BE = 543;

const parse = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  return { y, m };
};
const toYm = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

export default function MonthPicker({ value, max, onChange, label = "เลือกเดือน" }) {
  const cur = parse(value);
  const lim = max ? parse(max) : null;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(cur.y);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setYear(cur.y);
    setOpen((o) => !o);
  };
  const pick = (m) => {
    onChange(toYm(year, m));
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-11 items-center gap-2 rounded-xl border border-pp-line bg-white px-3 text-[15px] hover:bg-pp-ground"
      >
        <CalendarDays size={17} aria-hidden className="text-pp-muted" />
        {MONTHS_LONG[cur.m - 1]} {cur.y + BE}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-50 mt-2 w-[272px] rounded-2xl border border-pp-line bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="ปีก่อนหน้า"
              onClick={() => setYear((y) => y - 1)}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-pp-ground"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span className="font-semibold tabular-nums">พ.ศ. {year + BE}</span>
            <button
              type="button"
              aria-label="ปีถัดไป"
              disabled={lim && year >= lim.y}
              onClick={() => setYear((y) => y + 1)}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-pp-ground disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_SHORT.map((name, i) => {
              const m = i + 1;
              const selected = year === cur.y && m === cur.m;
              const disabled = lim && (year > lim.y || (year === lim.y && m > lim.m));
              return (
                <button
                  key={name}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${MONTHS_LONG[i]} ${year + BE}`}
                  onClick={() => pick(m)}
                  className={`h-10 rounded-lg text-sm ${
                    selected
                      ? "bg-pp-deep font-semibold text-white"
                      : "hover:bg-pp-ground disabled:text-pp-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
