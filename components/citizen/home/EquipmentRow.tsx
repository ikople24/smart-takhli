// components/citizen/home/EquipmentRow.tsx
// ศูนย์กายอุปกรณ์ ฉบับ citizen shell — การ์ดกะทัดรัดขนาดเดียว เลื่อนแนวนอน
// (AvailableListOnly เดิมใช้ breakpoint sm: ตามความกว้างจอ พอไปอยู่ในคอลัมน์
// ~480px บนจอคอมจะสลับเป็นการ์ดไซส์ใหญ่จนบวม) — ข้อมูลจาก useHealthMenuStore เดิม
import Image from "next/image";
import type { MenuObHealth } from "@/stores/useHealthMenuStore";

export default function EquipmentRow({
  menu = [],
  loading = false,
}: {
  menu?: MenuObHealth[];
  loading?: boolean;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[108px] w-[86px] shrink-0 animate-pulse rounded-[14px] bg-white/70" />
          ))
        : menu.map((item, index) => {
            const available = typeof item.available === "number" ? item.available : 0;
            const ok = available > 0;
            return (
              <div
                key={index}
                className="flex w-[86px] shrink-0 flex-col items-center rounded-[14px] bg-white px-2 py-2.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)]"
              >
                <div className="relative h-8 w-8">
                  <Image
                    src={item.image_icon || "/default-icon.png"}
                    alt={item.label}
                    width={32}
                    height={32}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="mt-1 line-clamp-2 text-center text-[10.5px] font-semibold leading-tight text-[#4A4458]">
                  {item.label}
                </div>
                <span
                  className="mt-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                  style={ok ? { background: "#E6F6EC", color: "#1B935A" } : { background: "#FDE5E7", color: "#B91C1C" }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ background: ok ? "#27AE60" : "#DC2626" }} />
                  {ok ? `ยืมได้ ${available}` : "ไม่พร้อมยืม"}
                </span>
              </div>
            );
          })}
    </div>
  );
}
