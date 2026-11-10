// components/complaints/manage/StatusTabs.jsx
// แท็บสถานะแบบ pill เลื่อนแนวนอน (มือถือ) — ตัวเลขในแท็บแทนการ์ดสถิติ
import clsx from "clsx";

// สีพื้นแท็บที่เลือก — ทุกสีผ่าน 4.5:1 กับตัวอักษรขาว
const TONES = {
  blue: { on: "border-blue-600 bg-blue-600", count: "bg-blue-100 text-blue-700" },
  red: { on: "border-red-600 bg-red-600", count: "bg-red-100 text-red-700" },
  green: { on: "border-emerald-700 bg-emerald-700", count: "bg-emerald-100 text-emerald-800" },
  orange: { on: "border-orange-700 bg-orange-700", count: "bg-orange-100 text-orange-800" },
};

export default function StatusTabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="กรองตามสถานะ">
      {tabs.map((t) => {
        const on = t.value === value;
        const tone = TONES[t.tone] || TONES.blue;
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.value)}
            className={clsx(
              "flex h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold",
              on ? clsx(tone.on, "text-white") : "border-gray-200 bg-white text-gray-700"
            )}
          >
            {t.label}
            <span className={clsx("rounded-full px-1.5 text-xs", on ? "bg-white/25 text-white" : tone.count)}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
