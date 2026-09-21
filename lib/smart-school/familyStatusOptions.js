// ตัวเลือกสถานะครอบครัว — แยกจาก models/smart-school/SchoolApplication.js เพราะไฟล์นั้น import mongoose
// ถ้า client component (เช่น InfoStep.jsx) import จากไฟล์ model ตรง ๆ จะลาก mongoose ทั้งก้อนเข้า client bundle
// (วัดจริง: First Load JS ของหน้าแรกพุ่งจาก 328 kB เป็น 586 kB) จึงแยกค่านี้มาไว้ที่นี่ให้ทั้งสองฝั่ง import ได้ปลอดภัย
export const FAMILY_STATUS_OPTIONS = [
  "บิดา-มารดาแยกกันอยู่", "แยกกันอยู่ชั่วคราว", "หย่าร้าง",
  "บิดาส่งเสีย", "มารดาส่งเสีย", "บิดา/มารดาไม่ได้ส่งเสีย",
];
