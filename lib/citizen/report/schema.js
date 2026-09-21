// lib/citizen/report/schema.js
// เกณฑ์ validate ของ wizard — ต้องตรง ComplaintFormModal.js:15-27 (ฟอร์มเดิม) ทุกข้อความ
import { z } from "zod";

export const stepCategorySchema = z.object({
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
});

export const stepDetailsSchema = z.object({
  community: z.string().min(1, "กรุณาระบุ 1 ชุมชน"),
  selectedProblems: z.array(z.string()).min(1, "กรุณาเลือกรายการปัญหาอย่างน้อย 1 รายการ"),
  imageUrls: z.array(z.string()).min(1, "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป"),
});

export const stepReporterSchema = z.object({
  prefix: z.string().min(1, "กรุณาเลือกคำนำหน้า"),
  fullName: z.string().min(2, "ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร"),
  phone: z.string().length(10, "เบอร์โทรศัพท์ต้องมี 10 หลัก"),
  detail: z.string().min(1, "กรุณากรอกรายละเอียด"),
  location: z
    .object({ lat: z.number(), lng: z.number() })
    .nullable()
    .refine((val) => val !== null, "กรุณาเลือกตำแหน่งที่ตั้ง"),
});

export const fullReportSchema = stepCategorySchema.merge(stepDetailsSchema).merge(stepReporterSchema);

// คืน error ต่อฟิลด์ (ข้อความแรกของฟิลด์นั้น) — object ว่าง = ผ่าน
export function validateStep(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors = {};
  for (const err of result.error.errors) {
    const key = err.path[0];
    if (key && !errors[key]) errors[key] = err.message;
  }
  return errors;
}
