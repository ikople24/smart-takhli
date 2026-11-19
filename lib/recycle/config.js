// ข้อมูลจุดรับที่แสดงบนหน้าประชาชน — ตั้งค่าผ่าน env (เว้นว่าง = ซ่อนกล่อง)
// NEXT_PUBLIC_RECYCLE_POINT_PLACE="ลานหน้าตลาดเทศบาล"  NEXT_PUBLIC_RECYCLE_POINT_HOURS="ทุกวันเสาร์ 08:00-11:00 น."
export const RECYCLE_POINT = {
  place: process.env.NEXT_PUBLIC_RECYCLE_POINT_PLACE || "",
  hours: process.env.NEXT_PUBLIC_RECYCLE_POINT_HOURS || "",
};

// ชื่อจุดรับที่แสดงหัวหน้าเจ้าหน้าที่ (ถ้ามี)
export const RECYCLE_POINT_LABEL = process.env.NEXT_PUBLIC_RECYCLE_POINT_PLACE || "";
