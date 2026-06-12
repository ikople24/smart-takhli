# กิจกรรม / ข่าวกิจกรรม (activities)

ระบบกิจกรรมของเทศบาล — เดิมเริ่มจาก "กิจกรรมนักเรียน" จึงมีชื่อ
`StudentFeedback` ติดมา แต่ขอบเขตจริงคือกิจกรรมทุกประเภท

> **สถานะ: ฟีดข่าวกิจกรรม implemented แล้ว (2026-06-12)** —
> spec: `docs/superpowers/specs/2026-06-12-activity-feed-design.md`

## ภาพรวมฟีดข่าวกิจกรรม

- 1 กิจกรรม = 1 โพสต์ข่าว: รูป ≤ 6 (`Activity.images`, Cloudinary), วันที่ดำเนินการ,
  คะแนนความพึงพอใจเฉลี่ยจาก `StudentFeedback.emotionLevel` (คำนวณสด ไม่ denormalize),
  ยอดผู้เข้าชม (`Activity.views`)
- หน้าหลัก (`pages/index.tsx`) แสดงการ์ดข่าว 3 ใบล่าสุด (แทน section ฟอร์มเดิม)
- หน้า `/activities` = ฟีดเต็ม + gallery + ฟอร์มความคิดเห็น (`ActivityFeedbackForm`)
  รองรับ `?activity=<id>` preselect; เปิดรายละเอียด = นับ view
  (กันซ้ำด้วย sessionStorage ฝั่ง client)

## โครงสร้าง

| ส่วน | ที่อยู่ |
|---|---|
| หน้า public ฟีด+ความเห็น | `pages/activities.tsx` |
| หน้า admin จัดการ+อัปโหลดรูป | `pages/admin/manage-activities.jsx` |
| API CRUD | `pages/api/activities/index.js`, `[id].js` — **POST/PUT/DELETE มี auth แล้ว** (`_auth.js#requireActivitiesAdmin` เช็คสิทธิ์ `/admin/manage-activities`), GET public |
| API ฟีด | `pages/api/activities/feed.js` — active + stats จาก aggregation |
| API นับวิว | `pages/api/activities/[id]/view.js` — POST public, `$inc views` |
| ความเห็น | `pages/api/student-feedback/*` |
| Models | `models/Activity.js` (collection `Activity`; มี `images[]≤6`, `views`), `models/StudentFeedback.js` (ผูก `activityId` — required) |
| Components ฟีด | `components/activities/ActivityFeed.jsx`, `ActivityFeedCard.jsx` (export `formatThaiDate`) |
| Components เดิม (ยังอยู่ root — รอเฟสจัดระเบียบ) | `ActivitySelector.js`, `ActivityFeedbackForm.tsx`, `ActivityFeedbackModal.tsx`, `StudentFeedbackForm.js`, `StudentFeedbackModal.js` |
| Upload รูป | `components/ImageUploads.js` (รับ `maxImages`, `initialImages` — default 3/[] สำหรับ complaint flow เดิม) |

เอกสารเดิม: `ACTIVITY_SYSTEM.md` ที่ root

## ข้อควรระวัง

- ความเห็นถูก scope ตามกิจกรรม (`StudentFeedback.activityId` required) —
  อย่าสร้าง feedback ลอยโดยไม่ผูกกิจกรรม ไม่งั้นข้อมูลกิจกรรมเก่า/ใหม่ปนกัน
- `Satisfaction` (คะแนนปิดเรื่องร้องเรียน) **ไม่เกี่ยว**กับคะแนนกิจกรรม
- PUT `/api/activities/[id]` แตะ `images` เฉพาะเมื่อ client ส่งฟิลด์มา
  (กัน client เก่าลบรูปทิ้ง)
- หน้า `/admin/feedback-analysis` ยังพัง (ถูก hideFromMenu ไว้)
