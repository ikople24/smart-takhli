// lib/citizen/status/progress.js
// map เรื่องร้องเรียน + assignment → ขั้นความคืบหน้า 1-4 (ใช้ทั้ง progress bar
// ในลิสต์และ timeline ในจอรายละเอียด) — เกณฑ์ตาม spec เฟส 3:
// 1 รับเรื่อง (createdAt) · 2 มอบหมาย (assignedAt) · 3 ดำเนินการแก้ไข (มี
// assignment ยังไม่เสร็จ) · 4 เสร็จสิ้น (status "ดำเนินการเสร็จสิ้น")
const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

export function statusProgress(complaint, assignment) {
  if (complaint?.status === DONE_STATUS) {
    return {
      step: 4,
      label: "ดำเนินการเสร็จสิ้น",
      at: assignment?.completedAt ?? complaint?.updatedAt ?? null,
    };
  }
  if (assignment) {
    return { step: 3, label: "ดำเนินการแก้ไข", at: null };
  }
  return { step: 1, label: "รับเรื่องร้องเรียน", at: complaint?.createdAt ?? null };
}

export function statusTimeline(complaint, assignment) {
  const { step } = statusProgress(complaint, assignment);
  const officer = assignment?.user;
  const officerDetail = officer
    ? [officer.department, officer.name].filter(Boolean).join(" · ")
    : "รอมอบหมายหน่วยงานผู้รับผิดชอบ";

  return [
    {
      key: "received",
      label: "รับเรื่องร้องเรียน",
      detail: "ระบบได้รับเรื่องแล้ว",
      at: complaint?.createdAt ?? null,
      reached: step >= 1,
    },
    {
      key: "assigned",
      label: "มอบหมายเจ้าหน้าที่",
      detail: officerDetail,
      at: assignment?.assignedAt ?? null,
      reached: step >= 2,
    },
    {
      key: "working",
      label: "ดำเนินการแก้ไข",
      detail: step >= 4 ? "แก้ไขปัญหาแล้ว" : "เจ้าหน้าที่กำลังแก้ไขปัญหา",
      at: null,
      reached: step >= 3,
    },
    {
      key: "done",
      label: "ดำเนินการเสร็จสิ้น",
      detail: "แก้ไขปัญหาเรียบร้อยแล้ว",
      at: assignment?.completedAt ?? (step >= 4 ? complaint?.updatedAt ?? null : null),
      reached: step >= 4,
    },
  ];
}
