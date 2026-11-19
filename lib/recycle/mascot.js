// ภาพการ์ตูนพระสังข์ของหน้า Loading — sprite 5 เฟรม (ดู components/recycle/RecycleLoading.jsx)
//
// ภาพเป็น CSS background ขนาด ~110KB จึงเริ่มโหลดตอน Loading โผล่ขึ้นมาแล้วเท่านั้น
// บนเน็ตมือถือภาพมักมาไม่ทันก่อน Loading ปิด (1.2–1.6 วิ) → เห็นแต่วงกลมเปล่า
// หน้าไหนโชว์ Loading ให้รอ waitForMascot() ก่อนปิด (มีเพดานเวลา ไม่ค้างถ้าเน็ตช้ามาก)
// ⚠️ เปลี่ยนภาพ = ตั้งชื่อไฟล์ใหม่ เพราะ next.config ให้ browser แคชไฟล์ใน /recycle/ ไว้ 7 วัน
export const MASCOT_SRC = "/recycle/phrasang-loading-strip.webp";

let mascotPromise = null;

/** เริ่มโหลดภาพ (เรียกซ้ำได้ โหลดครั้งเดียว) — resolve เมื่อภาพพร้อมแสดง หรือโหลดไม่สำเร็จ */
export function preloadMascot() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!mascotPromise) {
    mascotPromise = new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => (img.decode ? img.decode().then(resolve, resolve) : resolve());
      img.onerror = () => resolve();
      img.src = MASCOT_SRC;
    });
  }
  return mascotPromise;
}

/** รอภาพพร้อม แต่ไม่เกิน maxMs (ค่าเริ่มต้น 4 วิ) */
export function waitForMascot(maxMs = 4000) {
  return Promise.race([preloadMascot(), new Promise((r) => setTimeout(r, maxMs))]);
}
