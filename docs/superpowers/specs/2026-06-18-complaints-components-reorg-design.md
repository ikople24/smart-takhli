# เฟส 3: จัดระเบียบ components ร้องเรียน — Design

**วันที่:** 2026-06-18
**Roadmap:** เฟส 3 ใน [docs/modules/README.md](../../modules/README.md)
**ประเภท:** Refactor โครงสร้างไฟล์ (ไม่เปลี่ยนพฤติกรรม UI)

## เป้าหมาย

ย้าย components ร้องเรียนที่ยังกองอยู่ root ของ `components/` เข้าโฟลเดอร์โมดูล
`components/complaints/` ตาม convention พร้อมกำจัดไฟล์ซ้ำ/ตายที่ค้างมานาน

## ขอบเขต (scope)

**ทำในเฟสนี้:** ย้าย components + dedup คู่ซ้ำ + ลบ dead code เท่านั้น

**เลื่อนออกไป (ตัดสินใจร่วมกันแล้ว):**
- ย้าย `/api/assignments` → `/api/complaints/assignments` (roadmap เฟส 3 ระบุไว้ แต่เปลี่ยน
  URL จริงและกระทบ caller หลายจุด — แยกทำทีหลังเพื่อลดความเสี่ยง)
- API กำพร้าอื่น ๆ (`problem-options` vs `problemoptions`) — เฟส 7

## การตัดสินใจที่ยืนยันแล้ว

1. **คู่ซ้ำ:** ลบตัวเก่าที่ไม่มีใคร import (`ComplaintStats`, `OverdueComplaintsAlert`)
   แล้วเปลี่ยนชื่อตัวที่ใช้จริง `*New` → ชื่อหลัก (ไม่เหลือคำว่า "New")
2. **Dead code:** ลบ `CardCompleted` และ `ReporterInfoCard` ทิ้ง (ไม่มีใคร import — กู้คืน
   ได้จาก git ถ้าต้องการ)
3. **Import style:** ทุก import ที่ต้องแตะให้ใช้ alias `@/` (depth-independent, ไม่ต้องนับ `../`)

## 1. ไฟล์ที่ย้ายเข้า `components/complaints/`

| ไฟล์เดิม (root) | ปลายทาง |
|---|---|
| `ComplaintFormModal.js` | `components/complaints/ComplaintFormModal.js` |
| `ComplaintDetailModal.js` | `components/complaints/ComplaintDetailModal.js` |
| `ExportComplaints.js` | `components/complaints/ExportComplaints.js` |
| `CardAssignment.js` | `components/complaints/CardAssignment.js` |
| `CardModalDetail.js` | `components/complaints/CardModalDetail.js` |
| `CardOfficail.js` | `components/complaints/CardOfficail.js` |
| `ReporterInfoMap.js` | `components/complaints/ReporterInfoMap.js` |
| `ReporterInput.js` | `components/complaints/ReporterInput.js` |
| `CommunitySelector.js` | `components/complaints/CommunitySelector.js` |
| `UpdateAssignmentModal.js` | `components/complaints/UpdateAssignmentModal.js` |
| `ComplaintStatsNew.js` | `components/complaints/ComplaintStats.js` *(rename)* |
| `OverdueComplaintsAlertNew.js` | `components/complaints/OverdueComplaintsAlert.js` *(rename)* |

ใช้ `git mv` ทุกไฟล์เพื่อรักษา history

## 2. ไฟล์ที่ลบ (dead — ยืนยันไม่มี import)

- `components/ComplaintStats.js` (เวอร์ชันเก่า)
- `components/OverdueComplaintsAlert.js` (เวอร์ชันเก่า)
- `components/CardCompleted.js`
- `components/ReporterInfoCard.js`

## 3. ไฟล์ที่ "ไม่ย้าย" (อยู่ root ต่อ)

- `TaskCard.tsx` — generic (`type: 'complaint' | 'feedback'`) ใช้โดย `PendingTasksWidget`,
  `ProfileUser` — เป็น cross-cutting ไม่ใช่ของ complaints โดยเฉพาะ
- deps ที่ใช้ร่วมหลายโมดูล: `ImageUploads`, `SatisfactionChart`, `SatisfactionForm`,
  `stores/useAdminOptionsStore` — คงที่เดิม (โมดูลร้องเรียนแค่อ้างถึง)

## 4. แผนการแก้ import

### 4.1 ภายในไฟล์ที่ย้าย — relative ที่ชี้ออกไป deps "ไม่ย้าย" → `@/`

| ไฟล์ | import เดิม | แก้เป็น |
|---|---|---|
| `ComplaintFormModal.js` | `./ImageUploads` | `@/components/ImageUploads` |
| `CardModalDetail.js` | `./SatisfactionChart` | `@/components/SatisfactionChart` |
| `CardOfficail.js` | `./SatisfactionForm` | `@/components/SatisfactionForm` |
| `UpdateAssignmentModal.js` | `./ImageUploads` | `@/components/ImageUploads` |
| `UpdateAssignmentModal.js` | `../stores/useAdminOptionsStore` | `@/stores/useAdminOptionsStore` |

> import ระหว่างไฟล์ที่ย้ายด้วยกัน (`./CommunitySelector`, `./ReporterInput`,
> `./CardOfficail`, `./CardAssignment`, dynamic `./ReporterInfoMap`) **คง `./` เดิม** —
> ยังอยู่โฟลเดอร์เดียวกัน

### 4.2 ผู้เรียกภายนอก (9 จุด) → `@/components/complaints/...`

| ไฟล์ | components ที่อ้าง (รวม rename) |
|---|---|
| `pages/index.tsx` | ComplaintFormModal |
| `pages/admin/manage-complaints.jsx` | ComplaintDetailModal, ExportComplaints, UpdateAssignmentModal, ComplaintStatsNew→**ComplaintStats**, OverdueComplaintsAlertNew→**OverdueComplaintsAlert** |
| `pages/admin/dashboard.jsx` | ComplaintDetailModal, ExportComplaints |
| `pages/status/index.jsx` | CardModalDetail |
| `pages/complaint/[id_card].jsx` | CardModalDetail |
| `pages/complaint/index.jsx` | CardModalDetail |
| `pages/api/complaints/[id_card].js` | CardModalDetail ⚠️ ไฟล์ใน `api/` ที่ render JSX — แตะแค่ path import ไม่แก้ตรรกะ |
| `components/SatisfactionCommentsPanel.js` | CardModalDetail |
| `components/AdminDashboardMap.js` | CardModalDetail |

## 5. Verification

- `npm run build` → `✓ Compiled successfully`
- `npm run lint` → ไม่มี error ใหม่
- `grep -rn "components/ComplaintStatsNew\|components/OverdueComplaintsAlertNew" pages components` → ว่าง
- `grep -rn "ComplaintStatsNew\|OverdueComplaintsAlertNew\|CardCompleted\|ReporterInfoCard" pages components` → ว่าง
- ตรวจว่าไฟล์ root เดิม 12 ตัว + dead 4 ตัว หายไปจาก `components/` (เหลือใน `components/complaints/` 12 ไฟล์)

## 6. Git

ใช้ `git mv` รักษา history; แบ่ง 3 commit:
1. `refactor: ย้าย components ร้องเรียน → components/complaints/ + dedup *New→ชื่อหลัก`
2. `chore: ลบ dead components ร้องเรียน (CardCompleted, ReporterInfoCard, *เก่า)`
3. `docs: อัปเดต complaints.md — components ย้ายเข้าโฟลเดอร์โมดูลแล้ว`

## หมายเหตุการทดสอบ

โปรเจกต์ไม่มี test runner (CLAUDE.md) — ตรวจด้วย `npm run build` + `npm run lint` + grep
ตามข้อ 5 แทน unit test เพราะเป็น refactor ย้ายไฟล์ล้วน (ไม่เปลี่ยนพฤติกรรม)
