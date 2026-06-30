# ผู้ช่วยแนะรหัสแปลง SPLIT/MERGE/NEW — Design

> แท็บใหม่ "รหัสแปลงใหม่" ใน /admin/m10 — เอนจินแนะ ParcelCode สำหรับรายการ SPLIT/MERGE/NEW (deferred) จาก geometry+basemap+โฉนด → จนท. ยืนยัน → เขียน basemap + ดันเข้า worklist

วันที่: 2026-06-30 · โมดูล: `m10-ingest` · branch: `new-m10`

## ที่มา

หลัง basemap matcher รอบ A (จับ TRANSFER/OWNER_CORRECTION/BOUNDARY_CHANGE เข้า worklist ได้) ยังเหลือ changeType ที่ต้อง **ออกรหัส ParcelCode ใหม่** ก่อนคีย์ LTAX: `SPLIT`, `SPLIT_PUBLIC`, `MERGE`, `NEW` — ตอนนี้ค้างเป็น "deferred" ในหน้าสรุป

### ข้อค้นพบจากข้อมูลจริง (m10_transactions — สำคัญต่อดีไซน์)
- ปริมาณน้อย: SPLIT 5 · SPLIT_PUBLIC 3 · MERGE 10 · NEW 10
- **ไม่มี key ลิงก์ "แปลงพี่น้อง" ของเหตุการณ์เดียว:** `MERGE_PARCEL` ว่างทุกแถว, `PROCESS_ORDER` เป็นแค่ลำดับ step ไม่ใช่ group id
- ลิงก์ได้เฉพาะการ **อนุมาน**: geometry (รูปลูกตกในรูปแม่), เลขโฉนด/ที่ดินเรียงติดกัน+วันเดียวกัน
- ⇒ **auto-group ทั้งหมดไม่ได้** → เปลี่ยนเป็น **"ผู้ช่วยแนะรหัส (geometry/basemap แนะ → จนท. ยืนยัน)"** กฎการให้รหัสกลายเป็น logic การแนะ (pure fn) คนเป็นผู้ตัดสิน

กฎ ParcelCode อ้างอิง: memory `ltax-parcel-code-rules`

## หลักการ & เป้าหมาย

แท็บใหม่ list รายการ confirmed deferred → เอนจินแนะรหัส → จนท. ตรวจ/แก้/ยืนยัน → เขียนรหัสลง record + สร้างแปลงใน basemap (geometry จาก m10 เป็นตัวตั้งต้น) + record ไหลเข้า worklist ให้คีย์ LTAX

**Reuse ของเดิม (DRY):**
- ยืนยัน = เรียก `resolveReconcile` เดิม (set `reconcileOverride` + `writeBasemap=true` + `geometry=m10` → `applyBasemapEdit kind:new`). param `geometry` ที่ "พักไว้" ใน reconcile UI ได้ใช้งานจริงตรงนี้
- แผนที่ focus = `ReconcileMap` (read-only) ที่เคลียร์แล้ว
- worklist eligibility ขยายให้ครอบ deferred ที่ยืนยันแล้ว

## ขอบเขต

**ในรอบนี้:** เอนจินแนะรหัส 3 ประเภท (SPLIT+SPLIT_PUBLIC / MERGE / NEW) + แท็บ + ยืนยัน → basemap + worklist

**นอก scope:** auto-group siblings · ตั้ง RETIRED ให้แปลงที่ถูกรวม/แบ่งอัตโนมัติ · RETIRED · ปรับ `buildWorklistItem` script เฉพาะทางของ SPLIT/MERGE (รอบนี้ worklist item ของ deferred ใช้ builder เดิม + parcelCode ที่ยืนยัน)

## สถาปัตยกรรม

### 1. เอนจินแนะรหัส (pure — `lib/m10-ingest/parcelcode/`)

**`parcelCode.ts`** — แยกส่วน/สร้างรหัส (pure, ไม่มี IO):
- `parseParcelCode(code)` → `{ zone, block, seq, suffixes: string[] }` (เช่น `07K002/004` → zone `07`, block `K`, seq `002`, suffixes `["004"]`)
- `nextBlockSeq(zoneBlock, existingCodes)` → seq ถัดไปในบล็อก (เช่น `"02B"`, codes `["02B120","02B118"]` → `"02B121"`; เว้นเลขหายข้าม)
- `nextSuffix(parentCode, existingChildCodes)` → รหัสลูกถัดไป ตามชั้น: parent ไม่มี `/` → `/001` (3 หลัก); parent มี 1 `/` → `/01` (2 หลัก); 2 `/` → `/1`. หา suffix มากสุดที่ชั้นนั้นใต้ parent → +1

**`suggest.ts`** — `suggestForRecord(record, resolvers)` → `{ method, suggestedCode, confidence, parent, candidates, warnings }`
- resolver inject (async, ต่อ DB จริงตอนรัน / fake ตอน test):
  - `byDeed(deedNo)` → basemap docs โฉนดตรง
  - `byGeomOverlap(geometry)` → basemap docs ที่รูปทับ (เรียง overlap มาก→น้อย)
  - `childrenOfParent(parentCode)` → codes ที่ขึ้นต้น `parentCode + "/"`
  - `codesInBlock(zoneBlock)` → codes ที่ขึ้นต้น zoneBlock (ไม่มี `/`)
- logic ต่อประเภท:

| changeType | logic |
|---|---|
| **NEW** | `byDeed` ตรง → `suggestedCode = code นั้น` (method `deed-reuse`; เทียบเลขที่ดิน/สำรวจ/overlap ไม่ตรง → warning). ไม่ตรง → แม่จาก `byGeomOverlap[0]` → `zoneBlock` ของแปลงนั้น → `nextBlockSeq` (method `block-seq`). ไม่มี overlap → `suggestedCode=null` + warning "ระบุบล็อกเอง" |
| **SPLIT / SPLIT_PUBLIC** | parent = `byGeomOverlap[0]` (ทับมากสุด) → `nextSuffix(parent.parcelCode, childrenOfParent(...))` (method `split-suffix`). ไม่มี overlap → null + warning. default = แนะ suffix ลูก; จนท. เปลี่ยนเป็น "คงรหัสแม่" เองได้ |
| **MERGE** | overlaps = `byGeomOverlap(geometry)` → `suggestedCode = parcelCode น้อยสุด` (แปลงคง ตามกฎ) (method `merge-min`); ถ้า overlap หลายรหัส list ใน candidates |

- `confidence`: `high` (deed-reuse ตรงครบ / overlap ชัด), `medium` (overlap เดียว), `low` (เดาบล็อก/ไม่มี overlap)

### 2. Repository (`lib/m10-ingest/repository/index.ts`)
- `listNewCode(filter)` — รายการ `reviewStatus=confirmed` && `changeType ∈ DEFERRED_CHANGE_TYPES` แต่ละ record รัน `suggestForRecord` (resolver ต่อ DB) → คืน row `{ recordKey, deedNo, changeType, suggestedCode, method, confidence, currentParcelCode, resolved }`
- `getNewCodeItem(recordKey)` — detail: m10 geometry + suggestion + candidates(พร้อม geometry สำหรับ map) + parent + warnings
- **ยืนยัน:** thin wrapper `confirmNewCode(recordKey, by, input)` — โหลด record เอา `record.geometry` (m10) มาใส่ แล้วเรียก `resolveReconcile(recordKey, by, { ...input, geometry: record.geometry, writeBasemap: true })`
  - **เหตุผลที่ต้อง wrapper:** `resolveReconcile` ตอน writeBasemap เขียนเฉพาะ `overrideGeom` (รูปที่ จนท. แก้) ไม่ใช่ `rec.geometry` → ถ้าไม่ inject geometry basemap จะได้แปลงใหม่แบบ "ไม่มีรูป". wrapper จึงส่ง `geometry=record.geometry` ให้ตรง ๆ → basemap ได้ `kind:new` พร้อมรูปจาก m10 (ไม่แตะพฤติกรรม reconcile เดิม)
- **worklist eligibility ขยาย** ใน `summaryByPeriod` + `listWorklistPending`:
  - เดิม: `confirmed && changeType ∈ WORKLIST_CHANGE_TYPES`
  - ใหม่: `... OR (confirmed && changeType ∈ DEFERRED_CHANGE_TYPES && reconcileOverride.status === "resolved")`
  - `deferred` count = deferred ที่ **ยังไม่** resolved (ที่ resolved ย้ายไปนับเป็น wlEligible/wlPending)

### 3. API (`pages/api/m10-ingest/newcode/`)
- `GET index.js` — `listNewCode` (gate `/admin/m10`)
- `GET [recordKey]/index.js` — `getNewCodeItem`
- `POST [recordKey]/confirm.js` — body `{ parcelCode, deedNo?, landNo?, survey?, area? }` → `confirmNewCode` (inject geometry=record.geometry, writeBasemap=true); S2 reject → 422

### 4. UI (`components/m10/NewCodePanel.jsx` + tab ใน `pages/admin/m10.jsx`)
- เพิ่ม tab `{ key: "newcode", label: "รหัสแปลงใหม่", Panel: NewCodePanel }`
- **list mode:** ตาราง deferred — recordKey · โฉนด · ประเภท · รหัสที่แนะ (badge confidence) · method · สถานะ(ยืนยันแล้ว?) · ปุ่ม "เปิด"
- **focus mode:** `ReconcileMap` (read-only) เทียบรูป m10 (แดง) ↔ parent/candidates (น้ำเงิน/เขียว) + ป้าย warning + ฟอร์มรหัส (prefill suggestedCode, แก้ได้) + ปุ่ม "ยืนยันรหัส & เข้า worklist"
- ยืนยันสำเร็จ → กลับ list, record หาย (resolved) ไปโผล่ที่แท็บ worklist

## Data flow
```
แท็บรหัสแปลงใหม่ → listNewCode (deferred confirmed + suggestedCode ต่อ record)
เปิด record → getNewCodeItem (m10 geom + parent/candidates + รหัสที่แนะ + เตือน)
จนท. ตรวจ/แก้รหัส → [ยืนยัน] → POST confirm → resolveReconcile(geometry=m10, writeBasemap)
  → record.parcelCode + reconcileOverride.resolved + basemap แปลงใหม่ (kind:new จาก m10 geom)
  → record = worklist-eligible → คีย์ LTAX ที่แท็บ worklist (จนท. ไปปรับรูปละเอียดที่หน้า basemap ได้)
```

## Error / edge
- หาแม่/บล็อกไม่ได้ (รูปไม่ทับอะไร) → `suggestedCode=null` + warning "ระบุเอง" (ฟอร์มว่าง บังคับพิมพ์)
- NEW โฉนดตรงแต่เลขที่ดิน/สำรวจ/รูปไม่ตรง → warning conflict
- รหัสที่แนะ/พิมพ์ ชนรหัสเดิมใน basemap (ที่ไม่ใช่ parent) → warning (จนท. ตัดสิน, ไม่บล็อก)
- geometry m10 S2-invalid ตอนสร้าง basemap → 422 (applyBasemapEdit เดิม)
- ยืนยันซ้ำ record เดิม → resolveReconcile upsert override (idempotent)

## Testing
- **pure** (`parcelCode.test.ts`, `suggest.test.ts`):
  - `parseParcelCode("07K002/004")` → zone/block/seq/suffixes ถูก
  - `nextBlockSeq("02B", ["02B120","02B118"])` → `"02B121"`; บล็อกว่าง → `"02B001"`
  - `nextSuffix("01A001", [])` → `"01A001/001"`; `nextSuffix("01A001", ["01A001/001"])` → `"01A001/002"`; `nextSuffix("01A001/002", [])` → `"01A001/002/01"`
  - `suggestForRecord` ต่อประเภทด้วย fake resolvers: NEW deed-reuse / NEW block-seq / SPLIT suffix / MERGE min-code / no-overlap→null+warning
- **integration** (mongodb-memory-server):
  - `listNewCode` คืนเฉพาะ deferred confirmed + suggestedCode
  - confirm → record มี parcelCode + reconcileOverride.resolved; basemap มี doc ใหม่ (kind:new); record นับเป็น wlEligible ใน summary

## ที่ reuse (ไม่สร้างใหม่)
- `resolveReconcile` / `applyBasemapEdit` (เขียน basemap + override) · `matchParcel` resolvers pattern · `ReconcileMap` (read-only) · `DEFERRED_CHANGE_TYPES` / `WORKLIST_CHANGE_TYPES`
