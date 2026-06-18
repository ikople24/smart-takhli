# เรื่องร้องเรียน (complaints)

ประชาชนยื่นเรื่องร้องเรียน → เจ้าหน้าที่รับ/มอบหมาย/ติดตามสถานะ →
ปิดเรื่อง + ชวนประเมินความพึงพอใจ มีระบบ PDPA สำหรับ "เรื่องลับ"

## หน้า

- Public: `/complaint` (ยื่นเรื่อง), `/complaint/[id_card]`, `/status` (ติดตามสถานะ)
- Admin: `/admin/manage-complaints`, `/admin/my-tasks`, `/admin/dashboard`, `/admin/analytics`

## API

- `pages/api/complaints/*`, `pages/api/problems.js` (⚠️ อยู่ root ของ api/)
- `pages/api/assignments/*` — การมอบหมายงาน (⚠️ ควรย้ายใต้ complaints — เฟส 3)
- `pages/api/problem-options.js` + `pages/api/problemoptions/` (⚠️ ซ้ำซ้อน — เฟส 7)

## Models

`Complaint`, `Assignment`, `AdminOption`

## Components (⚠️ ยังกองที่ root ของ `components/` — รอเฟส 3)

`ComplaintFormModal`, `ComplaintDetailModal`, `ComplaintStats` + `ComplaintStatsNew`
(ซ้ำ — ต้องเลือกตัวเดียว), `ExportComplaints`, `CardAssignment`, `CardCompleted`,
`CardModalDetail`, `CardOfficail`, `OverdueComplaintsAlert` + `OverdueComplaintsAlertNew`
(ซ้ำ), `Reporter*`, `CommunitySelector`

## PDPA / เรื่องลับ

- ตรรกะอยู่ `lib/complaintPrivacy.js`
- เบลอภาพ: Cloudinary `e_blur` URL transform
- เซ็นเซอร์ข้อความ: เก็บ `pdpaDetailRedactions` (`{start,end}[]`) ที่แอดมินลากเลือกใน
  `ComplaintDetailModal`
- `lib/pdpaTextMask.js#maskSensitiveWords` ยังอยู่แต่**ไม่ใช้กับ flow สาธารณะแล้ว**

## Integration (LINE)

- **ฝั่ง server (ใช้งานอยู่)**: ยื่นเรื่องใหม่ → multicast แจ้งเจ้าหน้าที่ที่ follow OA
  (`lib/lineMessaging.ts`, gate ด้วย env `LINE_ADMIN_USER_IDS` — ไม่ตั้ง = skip) + n8n webhook;
  webhook ขาเข้า `pages/api/integrations/line-webhook.ts`
- **ฝั่งประชาชน (ลดรูปแล้ว 2026-06-12)**: กรอกฟอร์มปกติ ไม่มี LIFF login/choice screen —
  dialog หลังส่งสำเร็จมี**ปุ่มเดียว** "เพิ่มเพื่อน LINE OA" (`NEXT_PUBLIC_LINE_OA_URL`)
  สำหรับติดต่อสอบถามเพิ่มเติม
- `lib/liff.ts` + env `NEXT_PUBLIC_LIFF_ID` **เก็บไว้แต่ไม่มีใคร import** — รอพัฒนาการ
  เรียก user ผ่าน LINE รอบใหม่; ฟิลด์ `lineUserId` ใน Complaint model ยังอยู่ (ไม่ถูกเขียนแล้ว)
