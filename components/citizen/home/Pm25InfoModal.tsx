// components/citizen/home/Pm25InfoModal.tsx
// modal "ข้อมูลคุณภาพอากาศ" ฉบับ citizen — ระดับ+ค่าปัจจุบัน · แนวทางการป้องกัน ·
// ย้อนหลังรายวัน (ข้อความ/เกณฑ์จาก getPm25LevelInfo ตัวจริง ไม่ก็อปซ้ำ)
// ต่อท้ายด้วยหน้าปัด Pm25Dashboard เดิมทั้งตัว (กราฟ/เวลาที่อัปเดตครบแบบหน้าเก่า)
import dynamic from "next/dynamic";
import { getPm25LevelInfo } from "@/components/Pmdata";
import { pm25Level } from "@/lib/citizen/pm25Level";

// หน้าปัดเดิมลาก recharts มาด้วย — โหลดเมื่อผู้ใช้เปิด modal เท่านั้น
const Pm25Dashboard = dynamic(() => import("@/components/Pmdata"), { ssr: false });

type Daily = { date: string; avg: number; dayName?: string };

export default function Pm25InfoModal({
  value,
  daily,
  onClose,
}: {
  value: number;
  daily: Daily[];
  onClose: () => void;
}) {
  const info = getPm25LevelInfo(value || 0);
  const lv = pm25Level(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-[#1B1830]">ข้อมูลคุณภาพอากาศ</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F5FA] text-[#6B6880]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div
          className="flex items-center gap-3 rounded-[16px] p-3.5"
          style={{ background: lv.chipBg }}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight" style={{ color: lv.chipText }}>
              {info.label}
            </p>
            <p className="text-xs text-[#6B6880]">ค่าปัจจุบัน</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold tabular-nums" style={{ color: lv.chipText }}>
              {value || "–"}
            </span>
            <p className="text-[10px] text-[#9590A8]">µg/m³</p>
          </div>
        </div>

        <div className="mt-3 rounded-[16px] bg-[#F6F5FA] p-3.5">
          <h4 className="mb-1.5 text-[13px] font-bold text-[#1B1830]">แนวทางการป้องกัน</h4>
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[#4A4458]">{info.prevention}</p>
        </div>

        {/* หน้าปัด PM2.5 เดิมทั้งตัว — กราฟแนวโน้ม/เวลาที่อัปเดต แบบเดียวกับหน้าเก่า */}
        <div className="mt-3">
          <Pm25Dashboard />
        </div>

        {daily.length > 0 && (
          <div className="mt-3 rounded-[16px] border border-[#EFEDF4] p-3.5">
            <h4 className="mb-2.5 text-[13px] font-bold text-[#1B1830]">
              คุณภาพอากาศย้อนหลัง {daily.length} วัน
            </h4>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex gap-2" style={{ minWidth: "max-content" }}>
                {daily
                  .slice()
                  .reverse()
                  .map((day, index) => {
                    const dayLv = pm25Level(day.avg);
                    const parts = day.date.split("/");
                    const shortDate = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : day.date;
                    const isToday = index === 0;
                    return (
                      <div
                        key={index}
                        className="flex min-w-[58px] flex-col items-center rounded-[12px] px-2 py-2"
                        style={{
                          background: dayLv.chipBg,
                          outline: isToday ? `2px solid ${dayLv.dot}` : undefined,
                        }}
                      >
                        <span className="text-[15px] font-bold tabular-nums" style={{ color: dayLv.chipText }}>
                          {day.avg}
                        </span>
                        <span className="mt-0.5 text-[9.5px] text-[#6B6880]">{shortDate}</span>
                        {isToday && <span className="text-[8.5px] font-semibold text-[#6B6880]">วันนี้</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
