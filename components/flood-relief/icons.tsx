// components/flood-relief/icons.tsx
// ไอคอน 4 ประเภทคำขอ — inline SVG จากไฟล์ดีไซน์ (lucide ไม่มีตัวที่ตรง เช่น บ้านน้ำท่วม) เป็นเอกลักษณ์ของบล็อก
// ไอคอนทั่วไป (โทรศัพท์ ลูกศร ฯลฯ) ใช้ lucide-react ตามปกติ
import type { RequestType } from "@/lib/flood-relief/status";

const WAVE =
  "M2 19c1.7 0 1.7-1.5 3.3-1.5s1.7 1.5 3.3 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.3 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.3 1.5";
const WAVE_A =
  "M2 17.2c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2";
const WAVE_B =
  "M2 20.7c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.3 1.2";

export function TypeIcon({ type, size = 24 }: { type: RequestType | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "evac" && (
        <>
          <path d="M2.5 19V9" />
          <path d="M2.5 15h19v4" />
          <path d="M21.5 15v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7.5V15" />
          <circle cx="6.8" cy="12" r="1.8" />
          <path d="M16 3v5.5M13.25 5.75h5.5" />
        </>
      )}
      {type === "drain" && (
        <>
          <path d="M2.5 4h8a4 4 0 0 1 4 4v2.5" />
          <path d="M2.5 8H9a1.5 1.5 0 0 1 1.5 1.5v1" />
          <path d="M9.5 10.5h6" />
          <path d="M12.5 13.2v1.8" />
          <path d={WAVE} />
        </>
      )}
      {type === "sand" && (
        <>
          <rect x="2.5" y="13.5" width="9" height="6" rx="3" />
          <rect x="12.5" y="13.5" width="9" height="6" rx="3" />
          <rect x="7.5" y="6.5" width="9" height="6" rx="3" />
        </>
      )}
      {type !== "evac" && type !== "drain" && type !== "sand" && (
        <>
          <path d="M3.5 11.5 12 4.5l8.5 7" />
          <path d="M6 9.8v4.2" />
          <path d="M18 9.8v4.2" />
          <path d="M10 14v-3h4v3" />
          <path d={WAVE_A} />
          <path d={WAVE_B} />
        </>
      )}
    </svg>
  );
}
