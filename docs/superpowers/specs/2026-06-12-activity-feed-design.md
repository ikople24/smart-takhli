# Design: ฟีดกิจกรรม (Activity Feed)

วันที่: 2026-06-12 · สถานะ: อนุมัติแล้ว รอ implement · เฟส 2 ของ roadmap (`docs/modules/README.md`)

## เป้าหมาย

ยกระดับโมดูล activities จาก "ฟอร์มความคิดเห็น" เป็น **ฟีดกิจกรรมแบบแอป**:
แอดมินโพสต์กิจกรรมพร้อมรูป → ประชาชนเห็นฟีดที่หน้าหลักว่าเทศบาลทำอะไร เมื่อไร
พร้อมคะแนนความพึงพอใจจริงประกอบ

## การตัดสินใจหลัก (คุยกับเจ้าของระบบแล้ว)

| เรื่อง | ตัดสินใจ |
|---|---|
| โครงโพสต์ | **1 กิจกรรม = 1 โพสต์** — เพิ่มฟิลด์ใน `Activity` เดิม ไม่สร้าง model ใหม่ |
| รูปภาพ | สูงสุด **6 รูป**/กิจกรรม (Cloudinary URLs), รูปปก = `images[0]` |
| แหล่งคะแนน | `StudentFeedback.emotionLevel` (1-5, ผูก `activityId` อยู่แล้ว) — คำนวณสดด้วย aggregation ไม่ denormalize; `Satisfaction` ไม่เกี่ยว (เป็นคะแนนปิดเรื่องร้องเรียน) |
| หน้าหลัก | ฟีด 3 การ์ดล่าสุด **แทนที่** section ฟอร์มความคิดเห็นเดิม + ปุ่ม "ดูทั้งหมด" → `/activities` |
| ฟอร์มความคิดเห็น | อยู่ที่หน้า `/activities` ที่เดียว (ของเดิมมีอยู่แล้ว) |
| ใครโพสต์ | ผู้มีสิทธิ์หน้า `/admin/manage-activities` (ไม่มี workflow อนุมัติ) |
| สไตล์การนำเสนอ | **"ข่าวกิจกรรม" แบบเว็บข่าว/เว็บหน่วยงานทั่วไป** — การ์ดข่าว: รูปปกด้านบน, ป้ายวันที่, พาดหัว, เนื้อหาย่อ (ตัดจาก description), ลิงก์ "อ่านต่อ →" |
| สถิติผู้เข้าชม | นับ view ต่อกิจกรรม (ฟิลด์ `views`) แสดง 👁 บนการ์ด/หน้ารายละเอียด |

## ขอบเขตงาน

### 1. Model — `models/Activity.js` (ไฟล์เดิม ไม่ย้าย)
- เพิ่ม `images: { type: [String], default: [] }` + validate ≤ 6
- เพิ่ม `views: { type: Number, default: 0 }` — ยอดผู้เข้าชม
- คง field/collection เดิมทั้งหมด

### 2. API — `pages/api/activities/`
- **ใหม่** `GET /api/activities/feed?limit=N` (public):
  กิจกรรม `isActive: true` เรียง `startDate` desc, แนบ `stats: { avgRating, count }`
  ต่อกิจกรรมจาก aggregation `StudentFeedback` ($group by activityId, เฉพาะ `isApproved`)
- `POST /api/activities`, `PUT /api/activities/[id]`: รับ `images[]` + validate ≤ 6
- **ใหม่** `POST /api/activities/[id]/view` (public, ไม่มี auth):
  `$inc { views: 1 }` — เรียกแบบ fire-and-forget ตอนเปิดดูรายละเอียดกิจกรรม
  ฝั่ง client กันนับซ้ำด้วย `sessionStorage` (1 view/กิจกรรม/session — กันนับเฟ้อแบบง่าย
  พอเหมาะกับเว็บเทศบาล ไม่ทำ IP dedup)
- **เพิ่ม auth** ให้ `POST/PUT/DELETE` (ตอนนี้เปิดโล่ง — ใครก็ลบกิจกรรมได้):
  สร้าง `pages/api/activities/_auth.js` ตาม pattern `pages/api/pm25/_auth.js#requirePm25Admin`
  เช็คสิทธิ์ `/admin/manage-activities` ด้วย `pathMatchesPermission` + superadmin ลัด
- `GET` ทั้งหมดยัง public ตามเดิม

### 3. Admin — `pages/admin/manage-activities.jsx`
- modal สร้าง/แก้ไข: เพิ่ม `ImageUploads` (ขยาย `components/ImageUploads.js`
  ให้รับ prop `maxImages` — default เดิม 3, จุดเรียกเดิมไม่กระทบ)
- ตารางกิจกรรม: แสดง thumbnail รูปปก

### 4. Components ใหม่ — `components/activities/` (ตาม convention โมดูล)

สไตล์ = **section ข่าวกิจกรรม** แบบเว็บหน่วยงาน: หัว section "ข่าวกิจกรรม" + กริดการ์ดข่าว

- `ActivityFeed.jsx` — fetch `/api/activities/feed?limit=N` → กริดการ์ดข่าว
  (มือถือ 1 คอลัมน์ / desktop 3 คอลัมน์); prop `showViewAll` แสดงปุ่ม
  "ดูกิจกรรมทั้งหมด" (เปิดเฉพาะตอนใช้บนหน้าหลัก)
- `ActivityFeedCard.jsx` — การ์ดข่าวแนวตั้ง:
  - รูปปกด้านบน อัตราส่วน 16:9 (ไม่มีรูป = พื้น gradient + icon 📅)
  - ป้ายวันที่ไทยมุมรูป (`startDate` รูปแบบ "12 มิ.ย. 2569")
  - พาดหัว (ชื่อกิจกรรม, 2 บรรทัดตัดด้วย line-clamp)
  - เนื้อหาย่อจาก `description` (2-3 บรรทัด line-clamp)
  - แถวล่าง: ⭐ `avgRating` (ทศนิยม 1 ตำแหน่ง, "ยังไม่มีความเห็น" ถ้า 0) ·
    👁 `views` ผู้เข้าชม · ลิงก์ "อ่านต่อ →"
  - คลิกการ์ด → `/activities?activity=<id>`

### 5. หน้าหลัก — `pages/index.tsx`
- แทนที่ section `ActivityFeedbackForm` ด้วย `<ActivityFeed limit={3} />`

### 6. หน้า `/activities` — `pages/activities.tsx`
- การ์ดในกริดใช้สไตล์ข่าวเดียวกับฟีด (รูปปก + วันที่ + พาดหัว + 👁 views)
- รองรับ query `?activity=<id>` → preselect กิจกรรมนั้น
- รายละเอียดกิจกรรมที่เลือก (สไตล์หน้าอ่านข่าว): พาดหัว + วันที่ + 👁 views,
  gallery รูปทั้งหมด (≤6), คำอธิบายเต็ม, สถิติความพึงพอใจ
  + `ActivityFeedbackForm` (ของเดิมในหน้านี้)
- ตอนเปิดรายละเอียด: ยิง `POST /api/activities/[id]/view` (fire-and-forget,
  กันซ้ำด้วย sessionStorage key `activity-viewed-<id>`)

### 7. เอกสาร
- อัปเดต `docs/modules/activities.md` (เปลี่ยน design intent → สถานะ implemented)

## นอกขอบเขต (YAGNI)

- ไม่มี ActivityPost หลายโพสต์ต่อกิจกรรม, ไม่มี workflow อนุมัติโพสต์,
  ไม่มี comment บนโพสต์ (feedback ใช้ฟอร์มเดิม), ไม่ย้าย model/components เดิม
  เข้าโฟลเดอร์โมดูล (เป็นงาน roadmap เฟส 5), ไม่ทำ export/กราฟเปรียบเทียบ

## Edge cases

- กิจกรรมไม่มีรูป → การ์ดใช้พื้นหลัง gradient (ฟีดต้องไม่พัง)
- กิจกรรมไม่มี feedback → แสดง "ยังไม่มีความเห็น" (aggregation คืน 0/null ต้อง handle)
- กิจกรรมน้อยกว่า limit → แสดงเท่าที่มี; ไม่มีเลย → ซ่อน section ฟีดทั้งก้อน
- `images` เกิน 6 จาก API → reject 400
- ลบกิจกรรม → feedback ค้างใน DB ตามพฤติกรรมเดิม (บันทึกไว้ใน ACTIVITY_SYSTEM.md แล้ว)

## การทดสอบ

1. `npm run build` + `npm run lint` ผ่าน
2. Admin: สร้างกิจกรรม 6 รูป, แก้ไขลบรูป, พยายามใส่รูปที่ 7 → ถูกปฏิเสธ
3. หน้าหลัก: ฟีดแสดง 3 การ์ดข่าวล่าสุด, คะแนนเฉลี่ยตรงกับ feedback ใน DB
4. `/activities?activity=<id>` preselect ถูกตัว, gallery แสดงครบ, ส่ง feedback ได้
5. Views: เปิดรายละเอียดแล้ว `views` +1, refresh ใน session เดิมไม่นับซ้ำ,
   เปิด session ใหม่นับเพิ่ม
5. Security: `POST /api/activities` โดยไม่ login → 401; login ด้วย user ไม่มีสิทธิ์
   manage-activities → 403; GET ทั้งหมดยังเปิด public
