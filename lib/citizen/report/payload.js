// lib/citizen/report/payload.js
// payload สำหรับ POST /api/submittedreports/submit-report — shape ต้องตรง
// ComplaintFormModal.js:119-135 (ฟอร์มเดิม) ทุก field ห้ามแก้ฝั่งเดียว
// หมายเหตุ: ฟอร์มเดิมส่งค่าดิบ (ไม่ trim) — คงพฤติกรรมเดิมไว้
// consent: แนบเฉพาะเมื่อมีครบทั้ง version และ acceptedAt — ไม่มีก็ไม่ใส่คีย์
// (เรื่องที่ไม่มีข้อมูลยินยอมต้องได้ payload เหมือนเดิมทุกไบต์)
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

  if (state.consent?.version && state.consent?.acceptedAt) {
    payload.consent = {
      version: state.consent.version,
      acceptedAt: state.consent.acceptedAt,
    };
  }

  return payload;
}
