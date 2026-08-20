// lib/citizen/status/searchComplaints.js
// ค้นหาเรื่องร้องเรียนฝั่งประชาชน — ตัดช่องว่าง/ขีดออกก่อนเทียบ เพื่อให้
// "TKC-690016" · "tkc690016" · "TKC 690016" ค้นเจอเหมือนกัน และภาษาไทยที่คน
// พิมพ์เว้นวรรคไม่เหมือนกัน ("ไฟ ดับ" ↔ "ไฟดับ") ยังเจอ
// หมายเหตุ: API สาธารณะไม่มีพารามิเตอร์ค้นหา จึงกรองฝั่ง client จากชุดที่โหลดมา

export function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s-]/g, "");
}

// ช่องที่ยอมให้ค้น: เลขที่คำร้อง, หมวด, ชุมชน, หัวข้อปัญหา, รายละเอียด
// (ทั้งหมดเป็นข้อมูลที่การ์ดแสดงอยู่แล้ว — ไม่เปิดเผยอะไรเพิ่ม)
export function complaintSearchFields(complaint) {
  if (!complaint) return [];
  return [
    complaint.complaintId,
    complaint.category,
    complaint.community,
    complaint.detail,
    ...(Array.isArray(complaint.problems) ? complaint.problems : []),
  ];
}

export function matchesComplaintQuery(complaint, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  return complaintSearchFields(complaint).some((field) => normalizeSearch(field).includes(q));
}

export function filterComplaints(list, query) {
  const rows = Array.isArray(list) ? list : [];
  if (!normalizeSearch(query)) return rows;
  return rows.filter((c) => matchesComplaintQuery(c, query));
}
