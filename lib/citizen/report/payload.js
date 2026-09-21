// lib/citizen/report/payload.js
// payload สำหรับ POST /api/submittedreports/submit-report — shape ต้องตรง
// ComplaintFormModal.js:119-135 (ฟอร์มเดิม) ทุก field ห้ามแก้ฝั่งเดียว
// หมายเหตุ: ฟอร์มเดิมส่งค่าดิบ (ไม่ trim) — คงพฤติกรรมเดิมไว้
// consent: แนบเฉพาะเมื่อ consentForPayload() ตรวจผ่านเท่านั้น (version + acceptedAt ที่ parse เป็นวันที่ได้จริง)
// เพราะ acceptedAt เพี้ยนจะไป CastError ตอน SubmittedReport.create() ทำให้ "เซฟทั้งเรื่องร้องเรียนไม่ผ่าน"
// ไม่ใช่แค่เสียข้อมูล consent — เรื่องที่ไม่มี/ข้อมูลยินยอมใช้ไม่ได้ต้องได้ payload เหมือนเดิมทุกไบต์
import { consentForPayload } from "./consent";

export function buildComplaintPayload(state, problemOptions) {
  const payload = {
    prefix: state.prefix,
    fullName: state.fullName,
    phone: state.phone,
    community: state.community,
    problems: state.selectedProblems.map((id) => {
      const match = problemOptions.find((opt) => opt._id === id);
      return match ? match.label : id;
    }),
    category: state.category,
    images: state.imageUrls,
    detail: state.detail,
    location: state.location,
    status: "อยู่ระหว่างดำเนินการ",
    officer: "",
    updatedAt: new Date(),
  };

  const consent = consentForPayload(state.consent);
  if (consent) {
    payload.consent = consent;
  }

  return payload;
}
