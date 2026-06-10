# กิจกรรม (activities)

ระบบกิจกรรมของเทศบาล — เดิมเริ่มจาก "กิจกรรมนักเรียน" จึงมีชื่อ
`StudentFeedback` ติดมา แต่ขอบเขตจริงคือกิจกรรมทุกประเภท

## เป้าหมายที่เจ้าของระบบต้องการ (Design intent — เฟส 2 ของ roadmap)

> บันทึกไว้ 2026-06-10 เพื่อ brainstorm รายละเอียดก่อนลงมือ

ยกระดับเป็น **ฟีดกิจกรรมแบบแอป**:

1. แอดมิน**ลงโพสต์กิจกรรม**พร้อม**รูปภาพ** (Cloudinary) ว่าดำเนินการอะไร
2. ระบุ**วันที่ดำเนินการ**ชัดเจน
3. แสดง**ผลประเมินความพึงพอใจ**ของแต่ละกิจกรรมประกอบโพสต์
4. แสดงฟีดที่**หน้าหลัก** (`pages/index.tsx`) ให้ประชาชนเห็น

คำถามที่ต้องเคลียร์ตอน brainstorm: ใครโพสต์/ต้องอนุมัติไหม, จำนวนรูปต่อโพสต์,
คะแนนประเมินดึงจาก `StudentFeedback` (ผูก activityId อยู่แล้ว) หรือรวม
`Satisfaction` ด้วย, layout หน้าแรกวางฟีดตรงไหน

## สถานะปัจจุบัน

| ส่วน | ที่อยู่ |
|---|---|
| หน้า public เลือกกิจกรรม+ให้ความเห็น | `pages/activities.tsx` |
| หน้า admin จัดการกิจกรรม | `pages/admin/manage-activities.jsx` |
| API | `pages/api/activities/*`, `pages/api/student-feedback/*` |
| Models | `models/Activity.js` (collection `Activity`), `models/StudentFeedback.js` (ผูก `activityId` — required) |
| Components (ยังอยู่ root — รอเฟสจัดระเบียบ) | `ActivitySelector.js`, `ActivityFeedbackForm.tsx`, `ActivityFeedbackModal.tsx`, `StudentFeedbackForm.js`, `StudentFeedbackModal.js` |

เอกสารเดิม: `ACTIVITY_SYSTEM.md` ที่ root

## ข้อควรระวัง

- ความเห็นถูก scope ตามกิจกรรม (`StudentFeedback.activityId` required) —
  อย่าสร้าง feedback ลอยโดยไม่ผูกกิจกรรม ไม่งั้นข้อมูลกิจกรรมเก่า/ใหม่ปนกัน
- หน้า `/admin/feedback-analysis` ยังพัง (ถูก hideFromMenu ไว้)
