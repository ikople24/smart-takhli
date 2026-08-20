// components/citizen/report/CommunityPicker.tsx
// ตัวเลือกชุมชนธีมเทศบาล (ม่วง) + ปุ่ม "ชุมชนใกล้ฉัน" ที่มุม:
// ขอพิกัด → /api/citizen/locate-community (เช็คกับ polygon ชุมชนจาก base map)
// → เลือกให้อัตโนมัติแล้วย่อลิสต์เหลือชุมชนที่เลือก (กด "เปลี่ยนชุมชน" เพื่อกางใหม่)
// รายชื่อใช้ COMMUNITIES ชุดเดียวกับฟอร์มเดิม — ค่าที่ส่งเข้าระบบจึงตรงกันเสมอ
import { useState } from "react";
import { COMMUNITIES } from "@/lib/takhliCommunities";

type LocateState = "idle" | "locating" | "error";

export default function CommunityPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (community: string) => void;
}) {
  // เริ่มแบบย่อถ้ามีชุมชนเลือกไว้แล้ว (เช่น ย้อนกลับมาจากขั้น 3) — state ภายใน
  // รีเซตตอน unmount แต่ค่าที่เลือกอยู่กับ parent
  const [collapsed, setCollapsed] = useState(() => Boolean(selected));
  const [locate, setLocate] = useState<LocateState>("idle");
  const [locateMessage, setLocateMessage] = useState("");
  const [fromLocation, setFromLocation] = useState(false);

  const pick = (c: string, viaLocation = false) => {
    onSelect(c);
    setFromLocation(viaLocation);
    setCollapsed(true);
  };

  const locateMe = () => {
    if (locate === "locating") return;
    if (!("geolocation" in navigator)) {
      setLocate("error");
      setLocateMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocate("locating");
    setLocateMessage("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/citizen/locate-community?lat=${latitude}&lng=${longitude}`);
          const json = await res.json();
          if (json.success && json.community && COMMUNITIES.includes(json.community)) {
            pick(json.community, true);
            setLocate("idle");
          } else {
            setLocate("error");
            setLocateMessage("ตำแหน่งของคุณอยู่นอกเขต polygon ชุมชน — กรุณาเลือกเอง");
            setCollapsed(false);
          }
        } catch {
          setLocate("error");
          setLocateMessage("เช็คชุมชนไม่สำเร็จ กรุณาลองใหม่หรือเลือกเอง");
        }
      },
      () => {
        setLocate("error");
        setLocateMessage("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — กรุณาเลือกเอง");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div>
      <div className="mx-0.5 mb-2.5 mt-1.5 flex items-center justify-between gap-2">
        <label className="text-[13px] font-semibold">
          ชุมชน <span className="text-[#EF4444]">*</span>
        </label>
        <button
          type="button"
          onClick={locateMe}
          disabled={locate === "locating"}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#F1ECFE] px-3 py-1.5 text-[11.5px] font-semibold text-[#7C3AED] disabled:opacity-60"
        >
          {locate === "locating" ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
          {locate === "locating" ? "กำลังหาตำแหน่ง…" : "ชุมชนใกล้ฉัน"}
        </button>
      </div>

      {locateMessage && <p className="mx-0.5 mb-2 text-[11px] font-medium text-[#C77E10]">{locateMessage}</p>}

      {collapsed && selected ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] px-4 py-2 text-[13px] font-medium text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4 4L19 6" />
            </svg>
            {selected}
          </span>
          {fromLocation && <span className="text-[11px] text-[#9590A8]">จากตำแหน่งของคุณ</span>}
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="ml-auto text-[12px] font-medium text-[#7C3AED] underline-offset-2 hover:underline"
          >
            เปลี่ยนชุมชน
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {COMMUNITIES.map((c) => {
            const isSelected = selected === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] transition ${
                  isSelected
                    ? "bg-gradient-to-br from-[#7C3AED] to-[#9050F0] font-semibold text-white shadow-[0_6px_14px_rgba(124,58,237,0.35)]"
                    : "bg-white text-[#57506A] shadow-[0_2px_10px_rgba(124,58,237,0.08)] ring-1 ring-[#E9E3F8] hover:ring-[#C9B8F0]"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
