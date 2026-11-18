// ตัวช่วยเรียก API /api/recycle/* จากหน้าเว็บ (ใช้ cookie session ของ Clerk)

export async function recycleFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/recycle${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore — ตอบไม่ใช่ JSON
  }
  if (!res.ok || !json?.success) {
    const err = new Error(json?.message || `เกิดข้อผิดพลาด (${res.status})`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

/**
 * ลิงก์ที่ฝังใน QR บัตรสมาชิก — ⚠️ ห้ามเปลี่ยน path หลังพิมพ์บัตรแจกแล้ว
 * เจ้าหน้าที่ (ล็อกอิน) สแกน → ไปหน้ากรอกน้ำหนัก, สมาชิกสแกน → ดูยอด/ประวัติตัวเอง
 */
export function makeMemberCardUrl(origin, publicToken) {
  return `${origin}/recycle/m/${encodeURIComponent(publicToken)}`;
}

export function fmtKg(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
