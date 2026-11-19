// ธีมหน้าจอโครงการพระสังข์หอบทอง (ตามแคนวาส "พระสังข์หอบทอง — UI ฉบับปรับใหม่")
// สีหลัก: เขียวป่าบนพื้นครีม + ทองสำหรับของรางวัล, แต่ละหมวดขยะมีสีประจำ
import { IBM_Plex_Sans_Thai_Looped, Prompt } from "next/font/google";

// ฟอนต์ไทยแบบมีหัว อ่านง่ายสำหรับผู้สูงอายุ + Prompt สำหรับหัวข้อ/ตัวเลข
export const recycleBodyFont = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const recycleDisplayFont = Prompt({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/** ใส่ที่ root ของหน้า: ฟอนต์ตัวหนังสือ + พื้นครีม */
export const RECYCLE_ROOT = `${recycleBodyFont.className} bg-[#F5F3EC] text-[#17251C]`;
/** ใส่ที่ตัวเลข/หัวข้อ */
export const DISPLAY = recycleDisplayFont.className;

export const C = {
  ground: "#F5F3EC",
  ink: "#17251C",
  muted: "#51605A",
  line: "#E4E0D4",
  primary: "#146C43",
  primaryDark: "#0F5A37",
  primarySoft: "#E2F0E7",
  primaryInk: "#0B4A2D",
  gold: "#F4B740",
  goldSoft: "#FDF3D9",
  goldInk: "#3D2A00",
};

// สีตามหมวด: fg = เข้ม (ตัวหนังสือขาวบนนี้ผ่าน 4.5:1), bg = อ่อน, bar = สีกลางสำหรับแถบสัดส่วน
export const GROUP_THEME = {
  plastic: { fg: "#1F5FBF", bg: "#E6EEFB", bar: "#7FA8EC" },
  paper: { fg: "#9A5512", bg: "#FAEEDC", bar: "#E3A866" },
  metal: { fg: "#4B5763", bg: "#ECEFF2", bar: "#A7B1BA" },
  glass: { fg: "#0B7A6F", bg: "#DDF3EF", bar: "#5CC5B8" },
};

// ไอคอน (stroke path, viewBox 24) ตาม id ใน lib/recycle/wasteTypes.js
export const TYPE_ICON = {
  plastic_pet: "M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3zM8 12h8",
  plastic_hdpe: "M9 3h5l1 3h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8zM15 9h3",
  paper_box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  paper_office: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  metal_can: "M7 5a5 2 0 0 1 10 0v14a5 2 0 0 1-10 0zM7 5a5 2 0 0 0 10 0M7 9h10",
  metal_iron: "M12 2l8.5 5v10L12 22l-8.5-5V7zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  glass_bottle: "M10 2h4v4l1.5 2.5V21h-7V8.5L10 6zM8.5 13h7",
};
export const FALLBACK_ICON = "M4 7h16l-1 13H5zM9 7V4h6v3";

export const ICON = {
  back: "M15 18l-6-6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8h3v3H8zM13 13h3v3h-3zM13 8h3v3h-3zM8 13h3v3H8z",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  leaf: "M5 20c0-9 6-15 15-15c0 9-6 15-14 15zM5 20l7-7",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z",
};

// โทนสีการ์ดของรางวัล (ของรางวัลไม่มีหมวด → วนสีตามลำดับ)
export const REWARD_TONES = [GROUP_THEME.plastic, GROUP_THEME.paper, GROUP_THEME.glass, GROUP_THEME.metal];

export function Icon({ d, size = 24, strokeWidth = 1.8, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
