// components/citizen/fonts.ts
// ฟอนต์ของโมดูล citizen (โฉมใหม่ฝั่งประชาชน) — โหลดเฉพาะหน้าที่ใช้ CitizenShell
// next/font dedupe ให้เองถ้าซ้ำกับที่อื่น (ActivityFeedCard ก็ใช้ Anuphan)
import { Anuphan } from "next/font/google";

export const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
