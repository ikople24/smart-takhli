# เรื่องร้องเรียน (complaints)

ประชาชนยื่นเรื่องร้องเรียน → เจ้าหน้าที่รับ/มอบหมาย/ติดตามสถานะ →
ปิดเรื่อง + ชวนประเมินความพึงพอใจ มีระบบ PDPA สำหรับ "เรื่องลับ"

## หน้า

- Public: `/complaint` (ยื่นเรื่อง), `/complaint/[id_card]`, `/status` (ติดตามสถานะ)
- Admin: `/admin/manage-complaints`, `/admin/my-tasks`, `/admin/dashboard`, `/admin/analytics`

## API

- `pages/api/complaints/*`, `pages/api/problems.js` (⚠️ อยู่ root ของ api/)
- `pages/api/complaints/assignments/*` — การมอบหมายงาน (ย้ายเข้าใต้ complaints แล้ว เฟส 3, 2026-06-19)
- `pages/api/problem-options.js` + `pages/api/problemoptions/` (⚠️ ซ้ำซ้อน — เฟส 7)

## Models

`Complaint`, `Assignment`, `AdminOption`

## Components (`components/complaints/`)

`ComplaintFormModal`, `ComplaintDetailModal`, `ComplaintStats`, `OverdueComplaintsAlert`,
`ExportComplaints`, `CardAssignment`, `CardModalDetail`, `CardOfficail`,
`ReporterInfoMap`, `ReporterInput`, `CommunitySelector`, `UpdateAssignmentModal`

> ย้ายเข้าโฟลเดอร์โมดูลแล้ว (เฟส 3, 2026-06-18). คู่ซ้ำ `*New` รวมเป็นชื่อหลักแล้ว;
> dead code (`CardCompleted`, `ReporterInfoCard`, `*เก่า`) ถูกลบ
> `TaskCard.tsx` ยังอยู่ root (cross-cutting: complaint|feedback)

## PDPA / เรื่องลับ

- ตรรกะอยู่ `lib/complaintPrivacy.js`
- เบลอภาพ: Cloudinary `e_blur` URL transform
- เซ็นเซอร์ข้อความ: เก็บ `pdpaDetailRedactions` (`{start,end}[]`) ที่แอดมินลากเลือกใน
  `ComplaintDetailModal`
- `lib/pdpaTextMask.js#maskSensitiveWords` ยังอยู่แต่**ไม่ใช้กับ flow สาธารณะแล้ว**

## Integration (LINE)

- **แจ้งกลุ่มเจ้าหน้าที่ (2026-08)**: เรื่องใหม่ + ปิดงาน → push เข้า **LINE Group**
  (`lib/lineMessaging.ts#lineNotifyAdminGroup`) — groupId อ่านจาก Mongo `line_settings`
  (ตั้งผ่านหน้า `/admin/superadmin/line-settings`) fallback ไป env `LINE_ADMIN_GROUP_ID`;
  ไม่ตั้ง = skip เงียบ ๆ. **เลิกใช้** n8n/Telegram (`submit-tk`, `close-tk`,
  `complaintStatusChanged`, `complaintAssigned`, `assignmentCompleted`) และเลิกใช้
  multicast รายคน (`LINE_ADMIN_USER_IDS`)
- **webhook ขาเข้า** `pages/api/integrations/line-webhook.ts`: คำสั่ง `สถานะ <รหัส>`
  (บันทึก `lineUserId` ผูกกับเรื่อง → รับ push เมื่อสถานะเปลี่ยน), `groupid` (ตอบ groupId
  ของกลุ่ม), event `join` (บอทเข้ากลุ่ม → ตอบ groupId); ในกลุ่มบอทตอบ**เฉพาะคำสั่ง**
  ไม่ตอบข้อความทั่วไป
- **ฝั่งประชาชน**: dialog หลังส่งสำเร็จแสดงเลขเรื่อง + สอนผูก LINE (เพิ่มเพื่อน OA แล้วพิมพ์
  `สถานะ <เลขเรื่อง>`) เพื่อรับแจ้งเตือนความคืบหน้าอัตโนมัติ (`NEXT_PUBLIC_LINE_OA_URL`)
- `lib/liff.ts` + env `NEXT_PUBLIC_LIFF_ID` **เก็บไว้แต่ไม่มีใคร import** — รอพัฒนาการ
  เรียก user ผ่าน LINE รอบใหม่
