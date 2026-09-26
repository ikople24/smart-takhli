// components/flood-relief/icons.tsx
// ไอคอน 4 ประเภทคำขอ — inline SVG จากไฟล์ดีไซน์ (lucide ไม่มีตัวที่ตรง เช่น บ้านน้ำท่วม) เป็นเอกลักษณ์ของบล็อก
// ไอคอนทั่วไป (โทรศัพท์ ลูกศร ฯลฯ) ใช้ lucide-react ตามปกติ
import type { RequestType } from "@/lib/flood-relief/status";

const WAVE =
  "M2 19c1.7 0 1.7-1.5 3.3-1.5s1.7 1.5 3.3 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.3 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.3 1.5";

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
        // อาหาร น้ำดื่ม (key "other") — ขวดน้ำดื่ม + ชามข้าวมีตะเกียบ
        <>
          <path d="M5.4 2.8h2.4" />
          <path d="M5.6 2.8v2.4c-1.4.8-2.3 1.9-2.3 3.4V20a1 1 0 0 0 1 1h4.4a1 1 0 0 0 1-1V8.6c0-1.5-.9-2.6-2.3-3.4V2.8" />
          <path d="M3.3 11.5h6.4" />
          <path d="M3.3 15.2c1.1.6 2.1.6 3.2 0s2.1-.6 3.2 0" />
          <path d="M11.8 14h10.6a5.3 5.3 0 0 1-10.6 0Z" />
          <path d="M15.1 21h4" />
          <path d="M13.2 14c.5-2 2.2-3.2 3.9-3.2s3.4 1.2 3.9 3.2" />
          <path d="M17.6 9.6 21 3.4" />
          <path d="M19.6 10.2 22.6 5" />
        </>
      )}
    </svg>
  );
}
