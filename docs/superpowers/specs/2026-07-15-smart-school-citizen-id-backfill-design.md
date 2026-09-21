# Smart School — เก็บเลขบัตรประชาชนฝั่งแอดมิน (backfill ปีนี้ เตรียมยืนยันตัวตนปีหน้า)

> ต่อยอดจาก `2026-07-04-smart-school-scholarship-consideration-design.md`
> (ซึ่งตัด `citizenId` ออกจากระบบ) — เฟสนี้**นำเลขบัตรกลับมาเก็บฝั่งแอดมินเท่านั้น**
> วันที่: 2026-07-15

## ปัญหา/เป้าหมาย

ปีหน้าต้องการให้ผู้สมัคร (รายเก่า) ยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลัก
แต่ข้อมูลปัจจุบันไม่มีเลขบัตรเลย (spec 2026-07-04 ตัดฟิลด์นี้ออกทั้งระบบ)
→ ปีนี้ให้**เจ้าหน้าที่เป็นคนกรอกหลังบ้าน** (backfill ผู้สมัครเดิม ~238+ ราย
โดยตรวจกับเอกสารตัวจริง) เพื่อให้ปีหน้ามีฐานเลขบัตรพร้อมใช้

**นอกขอบเขตเฟสนี้:** ฟอร์มสาธารณะ (wizard) และ flow ยืนยันตัวตนด้วยเลขบัตร
ปีหน้า — ไม่แตะ `lookup`/`prefill`/`submit` เลย (ออกแบบเป็นเฟสถัดไป)

## การตัดสินใจหลัก (จาก brainstorming)

| ประเด็น | ตัดสินใจ |
|---|---|
| จุดกรอก | **ทั้งสองอย่าง** — ช่องในฟอร์มแก้ไข (`ApplicationEditModal`) + แท็บ worklist "เลขบัตร" ในแดชบอร์ดเดิม สำหรับไล่กรอกเร็ว ๆ |
| ตำแหน่ง worklist | **แท็บใหม่ใน `/admin/smart-school`** (ไม่เปิดหน้า admin ใหม่) — เลี่ยง checklist 4 จุด + migration สิทธิ์ ใครเข้าโมดูลได้ก็กรอกได้ |
| PDPA: การเก็บ | **เก็บเลขเต็มใน DB** (จำเป็นสำหรับ exact-match ปีหน้า + ตรวจกับเอกสาร) |
| PDPA: การแสดง | **เลขเต็มไม่ออกจากเซิร์ฟเวอร์เลย** — ทุก API ตอบเฉพาะเลขมาสก์ (`3-1023-xxxxx-xx-1`); แก้เลข = พิมพ์ใหม่ทั้ง 13 หลัก (เจ้าหน้าที่ถือเอกสารอยู่แล้ว); มีปุ่มล้างเลขกรณีผูกผิดคน |
| Validation | 13 หลัก + **checksum mod-11** (ฝั่ง client เตือนทันที + ฝั่ง server บังคับ) |
| เลขซ้ำ | **บล็อก + บอกว่าซ้ำกับใคร** (ชื่อ + ปีงบล่าสุดที่ยื่น) — ช่วยจับ record บุคคลซ้ำในทะเบียนไปด้วย |

## โครงข้อมูล

### models/smart-school/SchoolApplicant.js — เพิ่มฟิลด์

- `citizenId: String` — **unique sparse index**, เก็บเฉพาะตัวเลข 13 หลัก
  (digits-only, ไม่มีขีด)
- คนที่ยังไม่มีเลข = **ไม่มีฟิลด์/undefined** (ห้ามเป็น `""` หรือ `null`
  ไม่งั้น unique sparse ชนกันเอง) — การล้างเลขใช้ `$unset`
- เก็บที่**ทะเบียนบุคคล** (ไม่ใช่ใบสมัคร) เพราะเลขติดตัวคนข้ามปี
- **Prod:** ต้อง sync unique index ครั้งเดียวหลัง deploy
  (`SchoolApplicant.syncIndexes()` หรือรันสคริปต์/เชลล์) — ข้อมูลเดิมไม่มีฟิลด์นี้
  จึงไม่มี conflict

## lib/smart-school/citizenId.js (ใหม่ — helper กลาง)

- `normalizeCitizenId(input)` — ตัดขีด/ช่องว่าง เหลือ digits-only
- `isValidThaiCitizenId(id)` — 13 หลัก + checksum mod-11 (หลักที่ 13 =
  `(11 - (Σ digit[i]×(13-i) mod 11)) mod 10`)
- `maskCitizenId(id)` — คืนรูปแบบ `3-1023-xxxxx-xx-1` (เห็นหลัก 1–5 กับหลักสุดท้าย)
- ใช้ร่วมทั้ง API และ client (checksum ฝั่ง client ใช้ฟังก์ชันเดียวกัน)

## API — `pages/api/smart-school/`

ทุกตัวผ่าน `requireSchoolAdmin` (`_auth.js`) เหมือน endpoint แอดมินเดิม

### `citizen-id.js` (ใหม่) — `PUT`

- body `{ applicantRef, citizenId }`
  - `citizenId` เป็นเลข 13 หลัก → validate checksum → ไม่ผ่าน = **400**
  - ซ้ำกับ applicant อื่น → **409** + `{ duplicateOf: { name, prefix, latestYear } }`
    (ชื่อเต็ม — admin context ดูได้อยู่แล้ว)
  - `citizenId` = `null`/`""` → **ล้างเลข** (`$unset`)
- กัน race ด้วย unique index: catch `E11000` → ตอบ 409 เช่นเดียวกัน
- ตอบกลับเฉพาะ `{ citizenIdMasked }` — ไม่คืนเลขเต็ม

### `update.js` — แก้

- รับ `citizenId` เพิ่ม (optional): `undefined` = ไม่แตะ, `""`/`null` = ล้าง,
  เลข 13 หลัก = validate + dup-check ด้วย helper เดียวกับ `citizen-id.js`
  (แชร์ logic ผ่าน `lib/smart-school/citizenId.js` — ห้าม copy-paste)
- dup/checksum พัง → 409/400 **ก่อน** บันทึกฟิลด์อื่น (fail ทั้งก้อน ไม่บันทึกครึ่งเดียว)

### `list.js` — แก้

- แนบต่อแถว: `hasCitizenId: Boolean`, `citizenIdMasked: String|null`
- **ไม่ส่งเลขเต็มออกไป** (projection ดึงมาเพื่อ mask ฝั่ง server เท่านั้น)

## UI

### แท็บใหม่ "เลขบัตร" — `components/smart-school/admin/CitizenIdPanel.jsx`

- อยู่ใน `SmartSchoolDashboard` ต่อจากแท็บเดิม (ใช้ข้อมูลปีงบที่เลือกอยู่)
- แถบ progress: "มีเลขแล้ว x / y ราย" ของปีงบนั้น
- ค้นชื่อได้; default กรองเฉพาะ**คนที่ยังไม่มีเลข** (toggle ดูทั้งหมดได้ —
  คนมีเลขแล้วโชว์ masked)
- แถวละ: ชื่อ-นามสกุล / โรงเรียน / ระดับ + ช่องกรอก 13 หลัก + ปุ่มบันทึก
  - พิมพ์ครบ 13 หลัก → เช็ค checksum ทันที (ขอบแดง+ข้อความถ้าไม่ผ่าน)
  - **Enter = บันทึกแล้ว focus ช่องของแถวถัดไป** (ไล่กรอกต่อเนื่อง)
  - บันทึกสำเร็จ → แถวเปลี่ยนเป็นสถานะ "มีเลขแล้ว (masked)" และหลุดจากตัวกรอง default
  - 409 → แสดงข้อความ "ซ้ำกับ [ชื่อ] (ปี xx)" ใต้ช่อง ไม่เคลียร์ค่าที่พิมพ์

### `ApplicationEditModal.jsx` — เพิ่มช่อง "เลขบัตรประชาชน"

- ถ้ามีเลขอยู่แล้ว: แสดง masked เป็น placeholder + ช่องว่าง (พิมพ์ใหม่ = เปลี่ยน)
- ปุ่ม "ล้างเลข" (ส่ง `citizenId: null` ตอนบันทึก) — ใช้กรณีผูกผิดคน
- checksum ฝั่ง client เตือนก่อนกดบันทึก; error 409 จาก server แสดงชื่อคนซ้ำ

### `ApplicationDetailModal.jsx` — แสดงบรรทัด "เลขบัตร: `3-1023-xxxxx-xx-1`"

(หรือ "ยังไม่มีเลขบัตร")

## Error handling สรุป

| กรณี | ผล |
|---|---|
| ไม่ครบ 13 หลัก / checksum ไม่ผ่าน | client เตือนทันที; server ตอบ 400 |
| ซ้ำกับ applicant อื่น | 409 + ชื่อ/ปีของผู้ถือเลข (ทั้ง pre-check และ catch E11000) |
| ล้างเลข | `$unset` ฟิลด์ (ไม่เซ็ต `""`) |
| user ไม่มีสิทธิ์โมดูล | 401/403 จาก `requireSchoolAdmin` เดิม |

## การทดสอบ (ไม่มี test runner ในโปรเจกต์ — manual)

1. checksum: เลขจริงผ่าน / สลับหลักไม่ผ่าน / 12 หลักไม่ผ่าน
2. กรอกผ่าน worklist → refresh → masked ถูกต้อง, ตัวนับ progress ขยับ
3. กรอกเลขซ้ำ → เห็นชื่อคนที่ถือเลข
4. แก้/ล้างเลขผ่าน Edit Modal → detail modal อัปเดต
5. ตรวจ network tab: **ไม่มี response ไหนมีเลขเต็ม 13 หลัก**
6. user ที่ไม่มีสิทธิ์ smart-school ยิง `citizen-id.js` ตรง ๆ → 403

## เฟสถัดไป (บันทึกไว้ ไม่ทำรอบนี้)

- ฟอร์มสาธารณะปีหน้า: รายเก่ายืนยันด้วยเลขบัตร (exact match →
  คืนข้อมูล prefill) แทน/เสริมเบอร์ 4 ตัวท้าย — ออกแบบแยกเมื่อถึงรอบเปิดรับสมัคร
- รายใหม่กรอกเลขบัตรเองในฟอร์มสาธารณะ
