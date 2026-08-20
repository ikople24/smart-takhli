// lib/citizen/serviceLabels.js
// หมวดที่เป็น "บริการ" (ไม่ใช่เรื่องร้องเรียน) — ต้องสะกดตรงกับ Prob_name ใน DB
// ใช้ร่วมกัน: ServiceGrid (แยกกลุ่ม/เลือกปลายทาง), pages/preview.tsx (เลือก modal),
// wizard (กรองหมวดร้องเรียน) — อยู่ใน lib เพราะ export ค่าคงที่ปนไฟล์คอมโพเนนต์
// ทำให้ Fast Refresh ต้อง full reload ทุกครั้งใน dev
export const SERVICE_LABELS = ["ลงทะเบียนกายอุปกรณ์", "สำรวจการศึกษา"];
