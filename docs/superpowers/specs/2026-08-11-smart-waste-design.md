# Smart Waste — ระบบบันทึกขยะรีไซเคิลและขยะเปียก (กองสาธารณสุข)

- **วันที่:** 2026-08-11
- **โมดูล:** `smart-waste`
- **สถานะ:** design ผ่านการอนุมัติ รอทำแผน implementation

## 1. ปัญหาและเป้าหมาย

กองสาธารณสุข เทศบาลเมืองตาคลี บันทึกน้ำหนักขยะรีไซเคิลและขยะเปียกที่คัดแยกได้
**รายวัน** ลง Google Sheets/Excel ปีละ 1 ไฟล์ (ปีงบประมาณ ต.ค. → ก.ย.)
ปัจจุบันมี 2 ไฟล์: ปีงบ 2568 (เต็มปี) และ 2569 (กรอกถึง ธ.ค. 2568)

ปัญหาของวิธีเดิม:

- กรอกบนมือถือลำบาก — ตาราง 24 คอลัมน์ × 31 แถว ต้องเลื่อนซ้ายขวาหาช่อง
- สูตรรวมในชีตพังง่ายเมื่อแทรก/ลบแถว
- ไม่มี audit trail ว่าใครแก้ตัวเลขวันไหน
- ข้อมูลไม่ได้อยู่ในระบบเดียวกับพอร์ทัลอื่น ๆ ของเทศบาล

**เป้าหมาย:** เจ้าหน้าที่กองสาธารณสุขกรอกข้อมูลรายวันบน**มือถือ**ได้ภายในไม่กี่สิบวินาที
ข้อมูลลง MongoDB มี dashboard สรุป และ export กลับเป็น Excel หน้าตาเดิมเพื่อส่งรายงานต่อได้

**หน่วยน้ำหนัก: กิโลกรัม (กก.)** ทั้งระบบ — ยืนยันกับผู้ใช้แล้ว

## 2. สิ่งที่อ่านได้จากไฟล์ Excel ต้นทาง

โครงสร้าง 2 ไฟล์เหมือนกัน 100% (header row ตรงกันทุกตัวอักษร)

| ชีต | เนื้อหา |
|---|---|
| 12 ชีตรายเดือน (`ต.ค.67` … `ก.ย.68`) | 1 แถว = 1 วัน × 24 คอลัมน์ประเภทขยะ + `Total` · แถวสุดท้าย = `รวม` + เฉลี่ยต่อวัน |
| `รวมละเอียด` | สรุปรายเดือน แยก 24 ประเภทย่อย |
| `รวม` | สรุปรายเดือน ยุบเหลือ 8 กลุ่มใหญ่ + `เฉลี่ยต่อวัน` + `เฉพาะถุงอ่อน` + `Recheck` |

ยอดปี 2568 ทั้งปี = 245,509 กก. (เฉลี่ย ~670 กก./วัน) · ปี 2569 ถึง ธ.ค.68 = 42,196 กก.

**ตรวจสอบสูตรรวมแล้ว บวกกลับได้ตรงทุกกลุ่ม** — การ map 24 ประเภท → 8 กลุ่ม ด้านล่างจึงยืนยันได้จากข้อมูลจริง ไม่ใช่การเดา

### 2.1 พฤติกรรมการกรอกจริง

ในแต่ละวันมีการกรอกจริงเพียง **5–10 ช่องจาก 24** — ประเภทที่กรอกแทบทุกวันคือ
พลาสติกรวม, ขวดพลาสติก PET, ขวดแก้วใส, ขวดแก้วแดง, กระป๋องสังกะสี, ปุ๋ย, ถุงอ่อน
ที่เหลือกรอกนาน ๆ ครั้ง (เช่น `นุ่น` ทั้งปี 2568 มีแค่ 89 กก.)

**ข้อเท็จจริงนี้เป็นตัวกำหนดดีไซน์ฟอร์มมือถือ** — ห้ามแสดง 24 ช่องรวดเดียว

### 2.2 ตาราง mapping 24 ประเภท → 8 กลุ่ม (ใช้เป็น seed data)

`order` = ลำดับคอลัมน์ใน Excel เดิม ใช้คุม layout ตอน export

| order | key | label (ชีตรายวัน) | group | isCommon |
|---:|---|---|---|:---:|
| 1 | `paper_mixed` | กระดาษรวม | paper | |
| 2 | `paper_carton` | กระดาษลัง | paper | |
| 3 | `paper_white_black` | กระดาษขาวดำ | paper | |
| 4 | `plastic_rigid` | พลาสติกกรอบ | plastic | |
| 5 | `plastic_mixed` | พลาสติกรวม | plastic | ✅ |
| 6 | `plastic_pet` | ขวดพลาสติก PET | plastic | ✅ |
| 7 | `plastic_bottle_clear` | ขวดพลาสติกใส | plastic | |
| 8 | `plastic_bottle_hdpe` | ขวดพลาสติกขุ่น | plastic | |
| 9 | `plastic_hose` | สายยาง | plastic | |
| 10 | `plastic_strap` | สายรัดของ | plastic | |
| 11 | `plastic_linoleum` | เสื่อน้ำมัน | plastic | |
| 12 | `plastic_pvc_pipe` | ท่อ PVC | plastic | |
| 13 | `plastic_boots` | รองเท้าบู้ท | plastic | |
| 14 | `plastic_wire` | สายไฟ | plastic | |
| 15 | `glass_clear` | ขวดแก้วใส | glass | ✅ |
| 16 | `glass_amber` | ขวดแก้วแดง | glass | ✅ |
| 17 | `glass_green` | ขวดแก้วเขียว | glass | |
| 18 | `metal_tin_can` | กระป๋องสังกะสี | mixed_metal | ✅ |
| 19 | `aluminum_can` | กระป๋องอลูมิเนียม | aluminum | |
| 20 | `aluminum_scrap` | เศษอลูมิเนียม | aluminum | |
| 21 | `steel_scrap` | เหล็ก | steel | |
| 22 | `food_waste_compost` | ปุ๋ย | food_waste | ✅ |
| 23 | `plastic_soft_bag` | ถุงอ่อน | plastic | ✅ |
| 24 | `kapok` | นุ่น | kapok | |

**ข้อควรระวังจากข้อมูลจริง:**

- `plastic_wire` — ชีตรายวันเขียน "สายไฟ" แต่ชีต `รวมละเอียด` เขียน "เปลือกสายไฟ"
  → เก็บ `label` = "สายไฟ" และ `detailLabel` = "เปลือกสายไฟ" เพื่อให้ export ทั้งสองชีตตรงต้นฉบับ
- `food_waste_compost` — คอลัมน์ชื่อ "ปุ๋ย" แต่ในชีต `รวม` นับเป็นกลุ่ม "เศษอาหาร"
  → UI แสดง "ปุ๋ย (เศษอาหาร)" เพื่อลดความสับสน แต่ export ใช้ label เดิม
- `plastic_soft_bag` (ถุงอ่อน) **นับรวมอยู่ในกลุ่มพลาสติกแล้ว** แต่ชีต `รวม` มีแถว
  `เฉพาะถุงอ่อน` แยกอีกแถวหนึ่ง (ไม่ใช่กลุ่มที่ 9 — เป็น subset ที่โชว์ซ้ำ)

### 2.3 กลุ่มใหญ่ 8 กลุ่ม (ลำดับตามชีต `รวม`)

`paper` กระดาษ · `plastic` พลาสติก · `aluminum` อะลูมิเนียม · `steel` เหล็ก ·
`mixed_metal` โลหะผสม · `glass` แก้ว · `food_waste` เศษอาหาร · `kapok` นุ่น

กลุ่มเป็น **fixed ในโค้ด** (`lib/smart-waste/wasteGroups.js`) ไม่ให้แอดมินแก้
เพราะเป็นหัวข้อรายงานที่ส่งหน่วยงานภายนอก — ประเภทย่อยเท่านั้นที่แอดมินจัดการได้

## 3. ขอบเขต (scope)

**อยู่ในขอบเขต:**

1. ฟอร์มกรอกข้อมูลรายวันบนมือถือ
2. ตารางดู/แก้ไขข้อมูลย้อนหลัง
3. Dashboard สรุป + กราฟ
4. Export Excel รูปแบบเดิม
5. หน้าจัดการประเภทขยะ (แอดมินเพิ่ม/แก้/ปิดเองได้)
6. Script นำเข้าข้อมูลเก่าจากไฟล์ Excel ทั้ง 2 ปี

**ไม่อยู่ในขอบเขต (YAGNI):**

- แยกข้อมูลตามจุด/ชุมชน/รถเก็บขยะ — ผู้ใช้เลือก "วันละ 1 ชุด รวมทั้งเทศบาล"
- หน้าสาธารณะสำหรับประชาชน
- LINE notification
- cron / sync อัตโนมัติจาก Google Sheets (กรอกในระบบโดยตรง)

## 4. สถาปัตยกรรม

### 4.1 โครงสร้างไฟล์

ตาม convention ใน `CLAUDE.md` และ skill `.claude/skills/adding-feature-module/`
— หนึ่งโมดูล = โฟลเดอร์ชื่อเดียวกันในทุกชั้น ห้ามวางไฟล์ที่ root ของ `components/` หรือ `models/`

```
pages/admin/smart-waste.jsx
pages/api/smart-waste/
  _auth.js                 requireWasteAdmin
  types/index.js           GET list · POST create
  types/[id].js            PATCH · DELETE (soft)
  daily/index.js           GET list ตามช่วงวัน
  daily/[date].js          GET วันเดียว · PUT upsert
  summary.js               GET สรุปรายเดือนต่อปีงบ
  export.js                GET ไฟล์ .xlsx
components/smart-waste/
  wasteTheme.jsx           re-export token จาก smart-school + token เฉพาะโมดูล
  entry/DailyEntryForm.jsx · entry/TypePickerSheet.jsx · entry/TotalBar.jsx
  admin/MonthTable.jsx · admin/SummaryDashboard.jsx · admin/TypeManagerModal.jsx
lib/smart-waste/
  wasteGroups.js           8 กลุ่ม fixed + label ไทย + ลำดับ
  fiscalYear.js            แปลงวันที่ ↔ ปีงบประมาณ
  aggregate.js             ฟังก์ชัน pure คำนวณ groupTotals/totalKg (ใช้ร่วม 3 ที่)
  exportWorkbook.js        สร้าง workbook หน้าตาเดิม
models/smart-waste/
  WasteType.js             collection smart_waste_types
  WasteDaily.js            collection smart_waste_daily
docs/modules/smart-waste.md
scripts/import-waste-xlsx.js
scripts/grant-smart-waste-permission.js
```

### 4.2 เหตุผลของการเลือกโครงสร้างข้อมูลแบบ array

พิจารณา 3 ทางเลือก:

| ทางเลือก | ข้อสรุป |
|---|---|
| Wide columns (24 ฟิลด์คงที่) | **ตกรอบ** — แอดมินเพิ่มประเภทเองไม่ได้ ต้องแก้โค้ด + deploy ทุกครั้ง |
| Map/Object (`values: { plastic_pet: 1662 }`) | aggregate ต้อง `$objectToArray` ทุกครั้ง อ่านยาก debug ยาก |
| **Array of entries** ✅ | `$unwind` + `$group` ตรงไปตรงมา · เก็บเฉพาะช่องที่กรอกจริง (5–10 จาก 24) เอกสารเล็กกว่า wide · รองรับประเภทใหม่ทันที |

**เลือก array** + เก็บ `groupTotals`/`totalKg` แบบ denormalized ตอนบันทึก
เพื่อให้ dashboard และ export ไม่ต้อง aggregate ใหม่ทุกครั้ง

## 5. Data model

### 5.1 `WasteType` — `smart_waste_types`

```js
{
  key: String,          // unique · slug เช่น 'plastic_pet' — ห้ามเปลี่ยนหลังมีข้อมูลแล้ว
  label: String,        // 'ขวดพลาสติก PET' — แก้ได้
  detailLabel: String,  // ชื่อในชีต 'รวมละเอียด' ถ้าต่างจาก label (default = '')
  group: String,        // 1 ใน 8 key ของ wasteGroups.js
  order: Number,        // ลำดับคอลัมน์ใน Excel เดิม
  isCommon: Boolean,    // true = เด้งขึ้นหน้าแรกของฟอร์มมือถือ
  active: Boolean,      // false = ซ่อนจากฟอร์ม แต่ข้อมูลเก่ายังอยู่
  createdByClerkId, createdByName, updatedByClerkId, updatedByName
}
```

- `index { key: 1 }, unique`
- `index { active: 1, order: 1 }` สำหรับ list ฟอร์ม
- export แบบ `mongoose.models.WasteType || mongoose.model("WasteType", schema, "smart_waste_types")`
  — ระบุชื่อ collection เป็น argument ที่สามเสมอตามกติกาโมดูล

### 5.2 `WasteDaily` — `smart_waste_daily`

```js
{
  recordDate: String,   // 'YYYY-MM-DD' ตามวันในไทย — unique
  fiscalYear: Number,   // พ.ศ. ปีงบประมาณ เช่น 2569
  entries: [
    { typeKey: String, group: String, kg: Number }   // เก็บเฉพาะช่องที่กรอก (kg > 0)
  ],
  groupTotals: {        // denormalized — คำนวณตอน save
    paper, plastic, aluminum, steel, mixedMetal, glass, foodWaste, kapok
  },
  softBagKg: Number,    // ยอด plastic_soft_bag แยก (แถว 'เฉพาะถุงอ่อน' ในชีต รวม)
  totalKg: Number,
  note: String,
  createdByClerkId, createdByName, updatedByClerkId, updatedByName
}
```

- `index { recordDate: 1 }, unique` → กรอกวันเดิมซ้ำ = **แก้ของเดิม (upsert)** ไม่สร้างซ้ำ
- `index { fiscalYear: 1, recordDate: 1 }` สำหรับ dashboard/export

**เหตุผลที่ `recordDate` เป็น String ไม่ใช่ Date:** ตาม pattern ที่ใช้อยู่แล้วใน
`models/smart-papar/WaterQualityDaily.js` — เลี่ยงปัญหา timezone shift ทั้งหมด
(record ของวันที่ 1 ไม่กลายเป็นวันที่ 31 ของเดือนก่อนเมื่อ server อยู่ UTC)

**เหตุผลที่ snapshot `group` ลงใน entry:** ถ้าแอดมินย้ายประเภทข้ามกลุ่มในอนาคต
รายงานย้อนหลังที่เคยส่งออกไปแล้วต้องไม่เปลี่ยนตัวเลข · ส่วน `label` ไม่ snapshot
— resolve จาก master ตอนอ่าน (fallback เป็น `typeKey`) เพื่อให้แก้คำผิดแล้วมีผลย้อนหลัง

### 5.3 ฟังก์ชันร่วม `lib/smart-waste/aggregate.js`

```js
computeTotals(entries) → { groupTotals, softBagKg, totalKg }
```

ฟังก์ชัน pure ตัวเดียว ใช้ร่วมกัน **3 จุด**: ตอนบันทึกผ่าน API, ตอน import จาก Excel,
ตอนสร้างไฟล์ export — แก้สูตรที่เดียวมีผลทุกที่ ไม่ต้องไล่แก้หลายไฟล์

### 5.4 `lib/smart-waste/fiscalYear.js`

```js
fiscalYearOf('2025-10-15') → 2569   // ต.ค.–ธ.ค. = พ.ศ. + 1
fiscalYearOf('2026-08-11') → 2569
fiscalYearRange(2569) → { start: '2025-10-01', end: '2026-09-30' }
fiscalMonths(2569) → [{ key: '2025-10', sheetName: 'ต.ค.68', label: 'ต.ค. 68' }, ...]
```

## 6. API

ทุก endpoint อยู่ใต้ `pages/api/smart-waste/` และผ่าน `requireWasteAdmin` ใน `_auth.js`
ซึ่งลอก pattern มาจาก `pages/api/pm25/_auth.js#requirePm25Admin`
(getAuth → lookup Mongo → match `appId` → เช็ค `allowedPages` ผ่าน `pathMatchesPermission()` → superadmin ลัด)

**ไม่มี public endpoint ในโมดูลนี้** — ข้อมูลภายในหน่วยงานทั้งหมด

| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/api/smart-waste/types` | list ประเภท (`?includeInactive=1` สำหรับหน้าจัดการ) |
| POST | `/api/smart-waste/types` | เพิ่มประเภทใหม่ (validate `key` ไม่ซ้ำ, `group` ต้องอยู่ใน 8 กลุ่ม) |
| PATCH | `/api/smart-waste/types/[id]` | แก้ label / order / isCommon / active |
| DELETE | `/api/smart-waste/types/[id]` | soft delete → `active: false` · **ถ้ามี WasteDaily อ้างถึง typeKey นี้ ต้องปฏิเสธการลบจริง** |
| GET | `/api/smart-waste/daily?from=&to=` | list ช่วงวัน (สำหรับตารางรายเดือน) |
| GET | `/api/smart-waste/daily/[date]` | โหลด 1 วันมาแก้ (404 = ยังไม่มี → ฟอร์มเปล่า) |
| PUT | `/api/smart-waste/daily/[date]` | upsert 1 วัน · คำนวณ totals ฝั่ง server เสมอ · เขียน `AuditLog` |
| GET | `/api/smart-waste/summary?fiscalYear=` | สรุปรายเดือน 8 กลุ่ม + 24 ประเภท (ป้อน dashboard และ export) |
| GET | `/api/smart-waste/export?fiscalYear=` | ส่ง `.xlsx` |

**Validation ฝั่ง server (zod — มีใน dependencies แล้ว):**

- `recordDate` ต้องเป็น `YYYY-MM-DD` ที่มีอยู่จริง และไม่เป็นวันในอนาคต
- `kg` ต้องเป็นตัวเลข ≥ 0 · เกิน **1,000 กก./ประเภท/วัน** → เตือนแต่ให้บันทึกได้
  (ค่าสูงสุดที่เคยบันทึกจริงในข้อมูล 2 ปีคือ 415 กก./ประเภท/วัน — เกณฑ์ 1,000 จึงจับการพิมพ์เกินหลักได้
  โดยไม่บล็อกงานจริง)
- `typeKey` ต้องมีอยู่จริงและ `active: true` (ยกเว้น import script ที่ยอมรับ inactive)
- entry ที่ `kg` ว่าง/0 → ตัดทิ้งไม่เก็บลง array

**ห้ามเชื่อ totals ที่ client ส่งมา** — server คำนวณใหม่จาก `entries` ด้วย `computeTotals()` เสมอ

## 7. UI

ธีมและ design token ใช้ชุดเดียวกับ **smart-school** ตามที่ผู้ใช้ระบุ:
`components/smart-waste/wasteTheme.jsx` import token ร่วมจาก
`components/smart-school/survey/surveyTheme.jsx` (`inputCls`, `labelCls`, `primaryBtnCls`,
`chipCls`, `FONT_DISPLAY`, `FONT_BODY`) และ `components/smart-school/adminTheme.jsx`
(`StatCard`, `PillTabs`, `cardCls`, `tableHeadCls`) — **ไม่ fork ค่าสี** ม่วง `#7C3AED`

> หมายเหตุการ refactor: token ที่ใช้ข้ามโมดูลแบบนี้เข้าข่าย "ของกลางข้ามโมดูล"
> ตามกติกาข้อ 4 ของ skill `adding-feature-module` ถ้ามีโมดูลที่ 3 มาใช้อีก
> ให้สกัด `components/ui/adminTheme` ออกมาเป็นไฟล์กลาง — รอบนี้ยังไม่ทำ (YAGNI)
> แต่บันทึกไว้ใน `docs/modules/smart-waste.md`

### 7.1 หน้าเดียว 3 แท็บ — `/admin/smart-waste`

ใช้ `PillTabs`: **บันทึก · ข้อมูล · สรุป** พร้อมปุ่มเฟือง ⚙️ เปิด modal จัดการประเภทขยะ

### 7.2 แท็บ "บันทึก" (mobile-first — หัวใจของงาน)

```
┌─────────────────────────────┐
│  📅 11 ส.ค. 2569  [เมื่อวาน] │  default = วันนี้
│  ⚠ วันนี้บันทึกแล้ว — กำลังแก้ไข│  badge เมื่อเป็น update
├─────────────────────────────┤
│  กรอกบ่อย                    │
│  พลาสติกรวม      [    33 ] กก│
│  ขวดพลาสติก PET  [    45 ] กก│
│  ขวดแก้วใส       [    73 ] กก│
│  ขวดแก้วแดง      [    80 ] กก│
│  กระป๋องสังกะสี   [    24 ] กก│
│  ปุ๋ย (เศษอาหาร)  [   237 ] กก│
│  ถุงอ่อน         [   223 ] กก│
│  [ + เพิ่มประเภทอื่น ]        │→ bottom sheet
├─────────────────────────────┤
│ รวม 715 กก.      [ บันทึก ]  │  sticky bar อัปเดตสด
└─────────────────────────────┘
```

ข้อกำหนดที่ต้องทำ:

- แสดงเฉพาะประเภทที่ `isCommon` ก่อน (7 ช่อง) — ที่เหลือเพิ่มผ่าน bottom sheet
  ที่จัดกลุ่มตาม 8 กลุ่มใหญ่ + ช่องค้นหา
- ประเภทที่เพิ่มเข้ามาแล้วยังคงอยู่ในฟอร์มจนกว่าจะกดลบ (ถึงจะยังไม่ใส่ตัวเลข)
- `inputMode="numeric"` + `text-[16px]` บนมือถือ (กัน iOS auto-zoom ตอนโฟกัส
  — เหตุผลเดียวกับคอมเมนต์ใน `surveyTheme.jsx`)
- แถบยอดรวม sticky ล่างจอ อัปเดตสดขณะพิมพ์
- โหลดวันที่มีข้อมูลอยู่แล้ว → เติมค่าเดิมเข้าฟอร์ม + แสดง badge "กำลังแก้ไข"
- **draft autosave ลง `localStorage`** (key = `smart-waste-draft-<recordDate>`)
  กันเน็ตหลุด/ปิดจอกลางทาง · ล้าง draft เมื่อบันทึกสำเร็จ
- บันทึกสำเร็จ → SweetAlert2 (`sweetalert2` มีใน dependencies) + เคลียร์ฟอร์มไปวันถัดไป

### 7.3 แท็บ "ข้อมูล"

- เลือกเดือน (pill 12 เดือนของปีงบ) → ตารางแถว = วัน คอลัมน์ = ประเภท
  หน้าตาเหมือน Excel เดิม เลื่อนแนวนอนได้ (คอลัมน์ "วันที่" sticky ซ้าย)
- บนมือถือ default เป็น **card list ต่อวัน** (วันที่ + ยอดรวม + สรุปกลุ่ม) แตะเพื่อแก้
  สลับเป็น view ตารางได้ · บนจอใหญ่ default เป็นตาราง
- ทุกการแก้ไขเขียน `AuditLog` ผ่าน `lib/auditLogger.ts` ที่มีอยู่แล้ว
- แถวท้ายตาราง = ยอดรวมเดือน (คำนวณจาก `computeTotals` ตัวเดียวกัน)

### 7.4 แท็บ "สรุป"

- `YearPills` เลือกปีงบ (2568 / 2569 / …)
- `StatCard` 4 ใบ: รวมทั้งปีงบ · เฉลี่ยต่อวัน · เดือนล่าสุด · จำนวนวันที่บันทึกแล้ว
- กราฟด้วย `recharts` (มีใน dependencies):
  - แท่งซ้อน 8 กลุ่ม × 12 เดือน
  - เส้นเทียบปีงบต่อปีงบ (2568 vs 2569)
  - โดนัทสัดส่วน 8 กลุ่มของทั้งปี
- ปุ่ม **ดาวน์โหลด Excel** → `/api/smart-waste/export?fiscalYear=`

### 7.5 Modal จัดการประเภทขยะ

ทำเป็น modal ในหน้าเดิม **ไม่แยกเป็นหน้าใหม่** — เลี่ยงการเพิ่ม permission entry ที่ 2
และเลี่ยง migration สิทธิ์รอบสอง

- ตารางประเภทเรียงตาม `order` · toggle `isCommon` / `active` · แก้ label
- เพิ่มประเภทใหม่: กรอก label + เลือกกลุ่ม (จาก 8 กลุ่ม) → ระบบ gen `key` เป็น slug
  ให้แก้ได้ก่อนบันทึก แต่**ล็อกถาวรหลังบันทึก**
- ประเภทที่มีข้อมูลอ้างถึงแล้ว → ปุ่มลบ disabled พร้อม tooltip "มีข้อมูลใช้งานอยู่ ปิดใช้งานแทนได้"

## 8. Export Excel

`lib/smart-waste/exportWorkbook.js` ใช้ package `xlsx` (`^0.18.5` มีอยู่แล้ว)
สร้าง workbook ที่มีชีตครบและเรียงเหมือนต้นฉบับ:

1. `รวม` — 8 กลุ่ม × 12 เดือน + `SUM` + `Avg.` + แถว `รวม` / `เฉลี่ยต่อวัน` / `เฉพาะถุงอ่อน` / `Recheck`
2. `รวมละเอียด` — 24 ประเภท × 12 เดือน (ใช้ `detailLabel` ถ้ามี)
3. 12 ชีตรายเดือน ชื่อ `ต.ค.68` … `ก.ย.69` — แถว = วัน, คอลัมน์ตาม `order`,
   แถวท้าย = `รวม` และแถวเฉลี่ยต่อวัน

ค่าที่เขียนลงชีตเป็น**ตัวเลขนิ่ง (static values) ไม่ใช่สูตร** — เพราะแหล่งความจริงคือ
ฐานข้อมูล ไม่ใช่ชีต และเป็นสาเหตุที่สูตรในไฟล์เดิมพังเมื่อแทรกแถว

ช่องที่ไม่มีข้อมูลเว้นว่าง (ไม่ใส่ 0) เพื่อให้หน้าตาตรงกับไฟล์เดิม

## 9. Script นำเข้าข้อมูลเก่า

```bash
node --env-file=.env.local scripts/import-waste-xlsx.js <ไฟล์.xlsx> --fiscal-year 2568 [--dry-run]
```

ขั้นตอน:

1. อ่าน 12 ชีตรายเดือน · map header ภาษาไทย → `typeKey` ด้วยตารางในข้อ 2.2
   — **header ที่ map ไม่ได้ = หยุดทันที** ไม่ข้ามเงียบ
2. แปลงชื่อชีต + คอลัมน์ `วันที่` → `recordDate`
3. ข้ามแถว `รวม` และแถวเฉลี่ยท้ายชีต · ข้ามวันที่ที่ไม่มีจริงในเดือนนั้น
4. `computeTotals()` แล้ว upsert by `recordDate`
5. **verify:** บวกยอดที่ import ของแต่ละเดือน เทียบกับแถว `รวม` ในชีตต้นฉบับ
   ไม่ตรง → รายงาน diff และ **ไม่ commit ทั้ง batch**

**จุดที่พลาดง่ายที่สุด — ต้องมี test ครอบ:**

> ปีงบ ≠ ปีปฏิทิน ชีต `ต.ค.68` ในไฟล์ 2569 หมายถึง **ต.ค. พ.ศ. 2568 = ค.ศ. 2025-10**
> ไม่ใช่ 2026-10 · พลาดตรงนี้ข้อมูลเหลื่อมไปทั้งปี

หมายเหตุ: คอลัมน์วันที่ในชีตสรุปของไฟล์ต้นฉบับเก็บเป็น Excel serial ที่ปีเพี้ยน
(เช่น `25112` → 1968-10-01 จากการตีความปี พ.ศ. เป็น ค.ศ.) — **ห้ามใช้ค่านี้**
ให้อ่านวันที่จากชื่อชีต + คอลัมน์ `วันที่` ของชีตรายเดือนเท่านั้น

**เกณฑ์ความสำเร็จของการ import:** ยอดรวมปีงบ 2568 = 245,509 กก. และปีงบ 2569 = 42,196 กก.

Script ต้อง **idempotent** — รันซ้ำได้ผลเท่าเดิม (upsert ตาม `recordDate`)

## 10. สิทธิ์การเข้าถึง

ตาม CLAUDE.md การเพิ่มหน้า `/admin/...` ใหม่ต้องทำครบ **4 จุด** ขาดข้อใดข้อหนึ่งแล้ว
ผู้ใช้จะไม่เห็นเมนูหรือเข้าหน้าไม่ได้:

1. `lib/permissions.ts` → `ALL_PAGES` เพิ่ม
   `{ path: '/admin/smart-waste', label: 'smart-waste (ขยะรีไซเคิล)', icon: '♻️', category: 'management' }`
2. `DEFAULT_PERMISSIONS` ของ role ที่ควรเห็น
3. `components/LayoutAdmin.tsx` → `navigationItems` (hardcode แยกจาก `ALL_PAGES`)
4. `scripts/grant-smart-waste-permission.js` — user เดิมที่มี custom `allowedPages`
   ใน Mongo จะไม่เห็นหน้าใหม่จนกว่าจะรัน (ดูตัวอย่าง `scripts/grant-elderly-school-permission.js`)

การ match path ใช้ `pathMatchesPermission()` เท่านั้น — ห้ามเขียน `startsWith` เช็คสิทธิ์เอง

## 11. Error handling

| กรณี | พฤติกรรม |
|---|---|
| กรอกวันที่ที่มีข้อมูลแล้ว | โหลดค่าเดิมมาเติม + badge "กำลังแก้ไข" — ไม่สร้าง record ซ้ำ |
| เน็ตหลุดตอนกดบันทึก | draft ยังอยู่ใน `localStorage` · แสดง error ให้กดส่งซ้ำ · ไม่เคลียร์ฟอร์ม |
| ตัวเลขผิดปกติ (> 1,000 กก./ประเภท/วัน) | dialog ยืนยัน "ตัวเลขสูงผิดปกติ ยืนยันหรือไม่" — ยืนยันแล้วบันทึกได้ |
| ประเภทถูกปิดใช้งานหลังมีข้อมูล | ยังแสดงในตาราง/รายงานย้อนหลัง แต่ไม่ขึ้นในฟอร์มกรอกใหม่ |
| ลบประเภทที่มีข้อมูลอ้างถึง | API ตอบ 409 พร้อมจำนวน record ที่อ้างถึง · UI แนะให้ปิดใช้งานแทน |
| `fiscalYear` ที่ยังไม่มีข้อมูล | dashboard แสดง empty state ไม่ error |
| Export ปีที่ไม่มีข้อมูล | สร้างไฟล์โครงเปล่าครบ 14 ชีต (ไม่ throw) |

## 12. Testing

โปรเจกต์**ยังไม่มี test runner ติดตั้ง** (ระบุใน CLAUDE.md) — แผนคือติดตั้ง `vitest`
เฉพาะสำหรับ logic ล้วนของโมดูลนี้ ซึ่งเป็นส่วนที่พังเงียบและตรวจด้วยตาไม่ได้:

| ไฟล์ | สิ่งที่ต้องครอบ |
|---|---|
| `lib/smart-waste/fiscalYear.js` | ขอบเขต ก.ย.→ต.ค. · 2025-09-30 → 2568, 2025-10-01 → 2569 |
| `lib/smart-waste/aggregate.js` | ยอดกลุ่มจาก entries จริงของ ต.ค.68 ต้องได้ 18,396 กก. และตรงทุกกลุ่มกับชีต `รวม` |
| header mapping ใน import | header ทั้ง 24 ตัว map ครบ · header แปลกปลอม → throw |

ทดสอบด้วยมือ (ไม่คุ้มที่จะ automate รอบนี้): ฟอร์มบนมือถือจริง, export เปิดใน Excel/Sheets ได้

หลัง import จริงต้อง verify ยอด 245,509 / 42,196 กก. ก่อนถือว่างานเสร็จ

## 13. ลำดับการทำงานที่แนะนำ

1. `lib/smart-waste/*` (groups, fiscalYear, aggregate) + test — เป็นฐานของทุกอย่าง
2. `models/smart-waste/*` + seed 24 ประเภท
3. `scripts/import-waste-xlsx.js` + import จริง 2 ปี + verify ยอด
   → ได้ข้อมูลจริงไว้ทดสอบหน้าจอตั้งแต่ต้น ไม่ต้องกรอก mock
4. API (`_auth`, types, daily, summary)
5. หน้า `/admin/smart-waste` + 3 แท็บ + สิทธิ์ 4 จุด
6. Export + `docs/modules/smart-waste.md` + แถวใน `docs/modules/README.md`

## 14. คำถามที่ตัดสินใจไปแล้ว

| ประเด็น | ข้อสรุป |
|---|---|
| หน่วยบันทึก | วันละ 1 ชุด รวมทั้งเทศบาล (ไม่แยกจุด/ชุมชน) |
| หน่วยน้ำหนัก | กิโลกรัม |
| ข้อมูลเก่า | นำเข้าทั้ง 2 ปี (2568 + 2569) |
| ประเภทขยะ | แอดมินเพิ่ม/แก้/ปิดได้เอง (master data ใน Mongo) · กลุ่มใหญ่ 8 กลุ่ม fixed ในโค้ด |
| ขอบเขตรอบแรก | ฟอร์มมือถือ + ตารางแก้ไข + dashboard + export ครบทั้ง 4 |
| UI | ธีมและ token เดียวกับ smart-school |
