// ของกลางข้ามโมดูล: เลือกชุมชนจาก polygon ใน geojsonfeatures (basemap 22 ชุมชนของแอปพี่น้อง — อ่านอย่างเดียว)
// ใช้ร่วมกันระหว่าง garbage และ flood-relief — อย่าย้ายกลับเข้าโมดูลใดโมดูลหนึ่ง

/**
 * เลือกชุมชนจาก polygon ที่จุดตกอยู่
 * พื้นที่ทับซ้อนต้องได้คำตอบเดิมทุกครั้ง จึงเรียงชื่อแล้วเอาตัวแรก ไม่ใช่เชื่อลำดับที่ DB คืนมา
 */
export function pickCommunity(matches: Array<{ name: string }>): string | null {
  if (matches.length === 0) return null;
  return [...matches].map((m) => m.name).sort((a, b) => a.localeCompare(b, "th"))[0];
}
