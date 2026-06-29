# Spec: LTAX Worklist — ช่วยคีย์ ม.10 เข้า LTAX Online

**โมดูล:** ต่อยอด `m10-ingest` (ชั้น downstream: confirmed records → คีย์เข้า LTAX)
**วันที่:** 2026-06-28 · **สถานะ:** Draft พร้อมเข้า implementation
**บริบท:** Smart Takhli — เทศบาลเมืองตาคลี · ต่อจากรอบ m10-ingest (`docs/superpowers/specs/2026-06-21-m10-ingest-normalize-design.md`)

---

## 1. บริบทและขอบเขต

หลัง m10-ingest เจ้าหน้าที่มี `records` (กรรมสิทธิ์ที่ยืนยันแล้ว) แต่ยังต้อง **คีย์มือเข้า LTAX Online** (ระบบปิด ไม่มี API ต้องล็อกอิน). รอบนี้สร้าง **worklist ช่วยคีย์**: เลือกแปลงที่ยืนยันแล้ว → ระบบจัดรายการ + format field ตามลำดับหน้ากรอก LTAX + ปุ่ม copy รายช่อง → เจ้าหน้าที่คีย์เข้า LTAX เอง (ล็อกอินเอง) แล้ว mark ว่าคีย์แล้ว

**หลักการ:** ลดเวลา/ความพลาดของการคีย์มือ **โดยไม่แตะ credential / ไม่ทำ RPA** (ไม่ละเมิด ToS/ระเบียบราชการ)

**In scope**
- รวมหน้า ม.10 เป็นหน้าเดียว `/admin/m10` แบบ **tabs** (นำเข้า · คิวยืนยัน · ทะเบียน · worklist) — IA ใหม่ใต้กลุ่ม "แผนที่ภาษี"
- worklist สำหรับ changeType ที่ **แก้แปลงเดิม ไม่สร้าง Parcel Code ใหม่**: `TRANSFER` · `TRANSFER_PARTIAL` · `OWNER_CORRECTION` · `BOUNDARY_CHANGE`
- เลือกบางแปลง (checkbox) → guided keying ทีละแปลง + copy รายช่อง → mark keyed/skipped + ติดตาม progress
- สถานะการคีย์เก็บบน `M10Transaction` (idempotent — คีย์แล้วไม่ขึ้นซ้ำ)

**Out of scope (รอบถัดไป)**
- `SPLIT / MERGE / NEW` — ต้องคำนวณ **Parcel Code** (ดู §8) อ้างอิง basemap → ไปรวมกับรอบ basemap/reconcile
- `RETIRED` — ยังไม่ชัดเชิงระเบียบ → ให้เจ้าหน้าที่ตัดสินใจเอง (ไม่อยู่ใน worklist)
- RPA / auto-login / auto-fill เข้า LTAX
- ค้นหา/จับคู่เข้า basemap, diff/spatial reconcile

---

## 2. LTAX domain (จากเจ้าหน้าที่ — ground truth)

LTAX มี **2 โหมดค้นหา/แก้ไข**: (A) จากเจ้าของกรรมสิทธิ์ (B) จากเลขที่เอกสารสิทธิ์

**โหมด A (ตามที่เจ้าหน้าที่ไล่ให้):**
```
เมนู > ทะเบียนทรัพย์สิน > ข้อมูลทรัพย์สิน
  > ค้นหา: ชื่อ / นามสกุล / เลขบัตร
  > เจอในตาราง → [แก้ไข]
  > หาเลขที่เอกสารที่ต้องแก้ → [แก้ไข]
  > ดูจำนวนผู้ถือกรรมสิทธิ์
       กรณีโอน (คนเดียว → คนใหม่):
       → [เพิ่มเจ้าของกรรมสิทธิ์]  (ใส่เจ้าของใหม่)
       → [ลบเจ้าของกรรมสิทธิ์]   (เอาเจ้าของเดิมออก)
  > [บันทึก]
```

**ข้อสรุปเชิง action:**
- **TRANSFER** ใน LTAX = **เพิ่มเจ้าของใหม่ + ลบเจ้าของเดิม** บนเลขที่เอกสารเดิม → บันทึก (ไม่ใช่พิมพ์ทับช่องเดียว)
- **OWNER_CORRECTION / BOUNDARY_CHANGE** = แก้ในเอกสารเดิม (ชื่อ/เนื้อที่); มีผลเฉพาะแปลงนั้น ข้ามแปลงไม่ได้; แปลงอาจมีหลายเจ้าของ
- เจ้าของ **"เดิม" ที่ต้องลบ** LTAX แสดงบนจอเมื่อเปิดเอกสารอยู่แล้ว → worklist ไม่จำเป็นต้องรู้ก็ได้ (ใช้เป็นตัวช่วยค้นเฉย ๆ)

---

## 3. สถาปัตยกรรม IA — รวมเป็นหน้าเดียว + tabs

- หน้าใหม่ **`/admin/m10`** ใช้ `tabs tabs-lift` (DaisyUI) — tab: `นำเข้าข้อมูล` · `คิวยืนยัน` · `ทะเบียน (as-of)` · `Worklist → LTAX`
- deep-link ด้วย query `?tab=ingest|review|records|worklist` (default `ingest`)
- เนื้อหาแต่ละ tab ย้ายเป็น component: `components/m10/{IngestPanel,ReviewPanel,RecordsPanel,WorklistPanel}.jsx` (extract จาก 3 หน้าเดิม + worklist ใหม่)
- **ลบ route เดิม** `/admin/m10-ingest|m10-review|m10-records` (เป็น admin page ไม่มี QR/ลิงก์ภายนอกชี้มา — ปลอดภัยที่จะลบ)
- **Permission:** เหลือ **1 รายการ `/admin/m10`** แทน 3 รายการเดิม
  - `ALL_PAGES`: ลบ 3 → เพิ่ม `/admin/m10` (label "แผนที่ภาษี (ม.10)", category `management`)
  - `DEFAULT_PERMISSIONS.admin`/`superadmin`: แทน 3 path ด้วย `/admin/m10`
  - `navigationItems` (LayoutAdmin): ลบ 3 → เพิ่ม 1 รายการ
  - migration script: `$pull` 3 path เดิม + `$addToSet` `/admin/m10` ให้ user ที่มี custom allowedPages
- tab ทั้งหมดมองเห็นได้เมื่อมีสิทธิ์ `/admin/m10` (รอบนี้ไม่ทำ per-tab permission — YAGNI)

---

## 4. Data model — สถานะการคีย์ (เพิ่มบน `M10Transaction`)

```
M10Transaction (เพิ่มฟิลด์)
  ltaxStatus(pending|keyed|skipped, default "pending"),  // เฉพาะ txn ที่เข้าเกณฑ์ worklist จึงมีความหมาย
  ltaxKeyedBy: String,     // ชื่อ/clerkId เจ้าหน้าที่
  ltaxKeyedAt: Date,
  ltaxNote: String         // เหตุผลตอน skip หรือหมายเหตุ
```
- ไม่เพิ่ม collection ใหม่
- **worklist query:** `reviewStatus="confirmed"` && `changeType ∈ {TRANSFER, TRANSFER_PARTIAL, OWNER_CORRECTION, BOUNDARY_CHANGE}` && `ltaxStatus="pending"` → รายการที่ค้างคีย์
- index เพิ่ม: `{ ltaxStatus: 1, changeType: 1 }` (กรองรายการค้างเร็ว)

---

## 5. Field-mapping — pure function (หัวใจ, ทดสอบได้)

`lib/m10-ingest/worklist/buildWorklistItem.ts`

```
buildWorklistItem(txn, prevOwner?) → WorklistItem
```

ดึงเจ้าของ **ดิบ** จาก `txn.payloadRaw` (ตามคอลัมน์จริงของ parcel CSV):
`คำนำหน้า · ชื่อ · นามสกุล · "13 หลัก" · OWN_HSE_NO · OWN_MOO · OWN_SOI · OWN_VILLAGE · OWN_ROAD · OWN_TAMBOL · OWN_AMPHUR · OWN_PROVINCE`

```ts
interface WorklistField { label: string; value: string; copyable: boolean }
interface WorklistItem {
  txnId: string; recordKey: string; deedNo: string | null; period: string;
  changeType: "TRANSFER" | "OWNER_CORRECTION" | "BOUNDARY_CHANGE";
  action: "REPLACE_OWNER" | "CORRECT_OWNER" | "UPDATE_AREA";
  search: { deedNo: string | null; oldOwnerName: string | null }; // ใช้ค้นใน LTAX (โหมด A/B)
  steps: WorklistField[];   // เรียงตามลำดับที่กรอกใน LTAX
}
```

**ตารางลำดับ steps ต่อ changeType:**

| changeType | action | steps (เรียงตามกรอก) |
|---|---|---|
| TRANSFER | REPLACE_OWNER | (1) ค้นเลขโฉนด → (2) เพิ่มเจ้าของใหม่: คำนำหน้า·ชื่อ·นามสกุล·เลขบัตร13·บ้านเลขที่·หมู่·ซอย·ถนน·ตำบล·อำเภอ·จังหวัด → (3) ลบเจ้าของเดิม (`oldOwnerName` ถ้ามี) → (4) บันทึก |
| TRANSFER_PARTIAL | ADD_OWNER | (1) ค้นเลขโฉนด → (2) เพิ่มเจ้าของร่วม (เจ้าของเดิมคงอยู่) → (3) บันทึก |
| OWNER_CORRECTION | CORRECT_OWNER | (1) ค้นเลขโฉนด → (2) แก้ชื่อ: คำนำหน้า·ชื่อ·นามสกุล (+เลขบัตร13 ถ้าเปลี่ยน) → (3) บันทึก |
| BOUNDARY_CHANGE | UPDATE_AREA | (1) ค้นเลขโฉนด → (2) แก้เนื้อที่: ไร่·งาน·วา (จาก `txn.area`) → (3) บันทึก |

- `oldOwnerName` = best-effort จาก `record.history` รายการก่อนหน้า txn นี้ (ถ้ามี); ไม่มี → `null` (ค้นด้วยโฉนดอย่างเดียว)
- ฟังก์ชันนี้ **pure** (รับ txn doc + prevOwner, คืน object) → unit-test ด้วย fixture `payloadRaw` จริง

> ⚠ **ASSUMPTION — ลำดับ field:** ยังไม่ได้ยืนยันกับหน้ากรอก LTAX จริงว่าลำดับ step ตรงเป๊ะ. สิ่งที่ **แน่นอน** = *ชุด field* ที่ต้องใช้ (เจ้าของใหม่ + เลขบัตร + ที่อยู่ / ชื่อใหม่ / เนื้อที่) และการมี **copy รายช่อง + label ชัด**. *ลำดับ* ให้ถือเป็นค่าเริ่มต้นที่ปรับได้:
> - เก็บลำดับเป็น **data-driven** — แต่ละ changeType มี template `steps[]` (array of `{label,value,copyable}`) ใน config เดียว → จูนลำดับ/เพิ่ม-ลบช่องได้โดยไม่แตะ logic
> - unit test ยืนยัน "field set ครบ + label ถูก + ค่าดึงจาก payloadRaw ถูก" (ไม่ผูกกับลำดับตายตัว) เพื่อให้ปรับลำดับภายหลังไม่พังเทส
> - หลัง demo กับเจ้าหน้าที่/เห็นหน้าจอ LTAX จริง 1 รอบ → แก้ template ให้ตรง

---

## 6. Guided UI — tab "Worklist → LTAX"

- **List view:** ตาราง txn ที่ `ltaxStatus=pending` (กรอง period / changeType) + checkbox เลือก "บางแปลง" + ปุ่ม **"เริ่มคีย์"** (เข้าสู่ focus mode เฉพาะที่เลือก)
- **Focus mode (ทีละแปลง):**
  - หัวการ์ด: changeType + เลขโฉนด + recordKey + คีย์ค้นหา (โฉนด / เจ้าของเดิม) พร้อมปุ่ม copy
  - รายการ `steps` เรียงลงมา แต่ละช่องมีปุ่ม **copy** (คัดลอกค่าทีละช่องไปวางใน LTAX)
  - progress "`n/total`"
  - ปุ่ม **"คีย์แล้ว ✓"** → mark keyed → ไปแปลงถัดไป · ปุ่ม **"ข้าม"** → mark skipped + ใส่เหตุผล (`ltaxNote`)
- ไม่มีการเชื่อม/ยิงเข้า LTAX โดยตรง (คนคีย์เอง)

---

## 7. API + สิทธิ์ + PII

ภายใต้ `pages/api/m10-ingest/worklist/` (Clerk-guarded ด้วย `requireM10Admin(req, "/admin/m10")`):
- `GET worklist/index.js?period=&changeType=` → รายการ `ltaxStatus=pending` (ส่ง field เท่าที่ list ใช้ — ยังไม่ส่งเลขบัตรดิบ)
- `GET worklist/[id].js` → `buildWorklistItem` ของ txn เดียว (**ส่งเลขบัตร/ที่อยู่ดิบ** สำหรับ focus mode)
- `POST worklist/[id]/keyed.js` · `POST worklist/[id]/skip.js` (body: note)

**PII (สำคัญ):**
- จุดเดียวที่เลขบัตร 13 หลัก "ดิบ" ออกจาก DB ไปฝั่ง client = `GET worklist/[id]` (focus mode) — **ต้อง gate แน่น** (requireM10Admin + page `/admin/m10`)
- **ห้าม log เลขบัตร/payloadRaw** ใน server log; copy เป็น client-side clipboard เท่านั้น
- list endpoint ไม่ส่งเลขบัตรดิบ (ส่งเฉพาะตอนเปิด focus ทีละแปลง) — ลด exposure

---

## 8. Parcel Code rules (เก็บไว้อ้างอิงรอบหน้า — ไม่ implement รอบนี้)

> SPLIT/MERGE/NEW ต้องให้รหัส **Parcel Code** (`ZONE+BLOCK+ลำดับ` เช่น `01A001`, unique 1:1) อ้างอิง `PARCEL_COD` ใน basemap `public/parcel.shp.geojson` (13,436 แปลง)
> - **SPLIT:** แปลงคง = เลขที่ดินน้อยสุด (โฉนด/หน้าสำรวจ/ParcelCode คงเดิม, เนื้อที่ใหม่ < เดิม); แปลงแบ่งออกเรียงเลขที่ดินน้อย→มาก → suffix ตามชั้น `/001` (ชั้น1) → `/01` (ชั้น2) → `/1` (ชั้น3, หายาก), ไม่เกิน 3 ชั้น
> - **MERGE:** ParcelCode น้อยสุด = แปลงคง; เนื้อที่ ≈ ผลรวม (ใช้ค่าล่าสุดของ txn); จนท. confirm รหัส
> - **NEW:** เช็คเลขเอกสารตรงกับแปลงในระบบไหม → ตรง=ใช้ ParcelCode นั้น+เทียบข้อมูล, ใหม่จริง=หาบล็อก 3 ตัวหน้า → seq ถัดไป (เช่น `02B120`→`02B121`); จนท. confirm

---

## 9. Testing

- **Unit `buildWorklistItem`** (ไม่มี I/O): fixture `payloadRaw` จริงจาก parcel CSV → assert ต่อ changeType:
  - TRANSFER → action REPLACE_OWNER, steps มีเจ้าของใหม่ครบ (รวมเลขบัตร13 + ที่อยู่ดิบจาก `OWN_*`), ลำดับถูก
  - OWNER_CORRECTION → CORRECT_OWNER, มีชื่อใหม่
  - BOUNDARY_CHANGE → UPDATE_AREA, มี ไร่/งาน/วา จาก area
  - `oldOwnerName` = null เมื่อไม่มี prevOwner
- **Repository (mongodb-memory-server):** `markKeyed`/`markSkip` ตั้ง `ltaxStatus`+keyedBy/At/note ถูก; worklist query กรองเฉพาะ confirmed + 3 changeType + pending; idempotent (mark keyed แล้วหายจาก query)
- **Refactor sanity:** `/admin/m10` render ได้, แต่ละ tab โหลด panel ถูก, lint/tsc สะอาด
- **PII review:** ตรวจว่าไม่มีการ `console.log` payloadRaw/เลขบัตร ใน worklist API

---

## 10. รอบถัดไป

Parcel Code engine (SPLIT/MERGE/NEW) + จับคู่ basemap → diff/spatial reconcile → (อาจ) per-tab permission, ส่งออกชุด as-of 1 ม.ค.
