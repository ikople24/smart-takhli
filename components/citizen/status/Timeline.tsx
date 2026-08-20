// components/citizen/status/Timeline.tsx
// timeline 4 ขั้นในจอรายละเอียดสถานะ (แคนวาส "รายละเอียดสถานะ") —
// แถวจาก statusTimeline: จุดม่วง = ถึงแล้ว, เทา = ยังไม่ถึง, เส้นเชื่อมตามสถานะ
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

type Row = { key: string; label: string; detail: string; at: string | null; reached: boolean };

export default function Timeline({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
      {rows.map((row, i) => (
        <div key={row.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
              style={{ background: row.reached ? "#7C3AED" : "#E4DEF2" }}
            >
              {row.reached && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4 4L19 7" />
                </svg>
              )}
            </span>
            {i < rows.length - 1 && (
              <span className="w-[2px] flex-1" style={{ background: rows[i + 1].reached ? "#7C3AED" : "#EFEDF4" }} />
            )}
          </div>
          <div className={i < rows.length - 1 ? "pb-4" : ""}>
            <div className={`text-[13.5px] font-semibold ${row.reached ? "text-[#1B1830]" : "text-[#9590A8]"}`}>
              {row.label}
            </div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-[#9590A8]">
              {row.detail}
              {row.at ? ` · ${formatThaiDate(row.at)}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
