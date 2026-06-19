# Elderly School Dashboard (Smart-Health)

## Goal
แสดงสรุป “ผู้มาเรียน ณ วันที่เลือก” ว่ามีค่า **BMI** และ **ความดันโลหิต (BP)** อยู่ในเกณฑ์ **ปกติ** / **เสี่ยง** กี่คน บนหน้า `admin/smart-health`.

## What was added
- API: `GET /api/smart-health/elderly-school-dashboard?date=YYYY-MM-DD`
- UI: แท็บ “โรงเรียนผู้สูงอายุ” บนหน้า `admin/smart-health`

## Required environment variables
ตั้งค่า URL ของ CSV ที่ “เข้าถึงได้แบบ public”:

- `ELDERLY_SCHOOL_SHEET_CSV_URL` (required)

Optional (ถ้าชื่อคอลัมน์ใน sheet ไม่ตรงกับที่ระบบเดา):
- `ELDERLY_SCHOOL_SHEET_DATE_COLUMN`
- `ELDERLY_SCHOOL_SHEET_WEIGHT_COLUMN`
- `ELDERLY_SCHOOL_SHEET_HEIGHT_COLUMN`
- `ELDERLY_SCHOOL_SHEET_SYSTOLIC_COLUMN`
- `ELDERLY_SCHOOL_SHEET_DIASTOLIC_COLUMN`
- `ELDERLY_SCHOOL_SHEET_BP_COLUMN` (กรณีความดันมาเป็น “120/80” คอลัมน์เดียว)
- `ELDERLY_SCHOOL_SHEET_BP1_COLUMN` (เช่น “การวัดความดันโลหิต ครั้งที่ 1”)
- `ELDERLY_SCHOOL_SHEET_BP2_COLUMN` (เช่น “การวัดความดันโลหิต ครั้งที่ 2”)
- `ELDERLY_SCHOOL_SHEET_CITIZENID_COLUMN` (แนะนำ: ให้ชี้ไป “เลขประจำตัวประชาชน” เพื่อให้นับแบบ unique ได้ถูก)
- `ELDERLY_SCHOOL_SHEET_ID_COLUMN` (เช่น เลขบัตรประชาชน/รหัส เพื่อให้นับแบบ unique ได้)

## Visit / ครั้งที่ (1–16) — ใช้ “ครั้งล่าสุด” เป็นค่าเริ่มต้น
เพราะ “1 คนต้องมาเรียนทั้งหมด 16 ครั้ง” และฟอร์มจะมีคอลัมน์น้ำหนัก/ความดัน **ซ้ำเป็นชุด ๆ** ในแถวเดียวกัน ระบบรองรับการสรุปตามครั้งที่:

- `visit=latest` (ค่าเริ่มต้น): ใช้ “ครั้งล่าสุดที่มีค่า” ในแต่ละแถว
- `visit=1..16`: ใช้ชุดคอลัมน์ของครั้งที่เลือก

ตัวอย่าง:
- `GET /api/smart-health/elderly-school-dashboard?date=2026-01-08&visit=latest`
- `GET /api/smart-health/elderly-school-dashboard?date=2026-01-08&visit=3`

หมายเหตุ: เนื่องจาก `ประทับเวลา` อาจถูกกรอกย้อนหลัง Dashboard ในหน้าแอดมินจึง **ไม่กรองตามวันที่** และจะสรุปจากข้อมูลทั้งหมดโดยอัตโนมัติ (ยังสามารถส่ง `date=YYYY-MM-DD` ผ่าน API ได้ถ้าต้องการกรองเอง)

## How to make Google Sheet accessible as CSV
ตัวเลือกที่แนะนำ:

1) ตั้งค่า Share เป็น “Anyone with the link → Viewer”
2) ไปที่ `File → Share → Publish to the web`
3) เลือก Sheet ที่ต้องการ แล้วเลือกเป็น `CSV`
4) นำลิงก์ CSV ที่ได้มาใส่ใน `ELDERLY_SCHOOL_SHEET_CSV_URL`

> ถ้า API แจ้งว่าได้ HTML แทน CSV แปลว่าไฟล์ยังไม่ public หรือยังไม่ได้ publish เป็น CSV
> หลังตั้งค่า `.env.local` ต้อง **restart** `npm run dev` เพื่อให้ Next.js โหลด env ใหม่

## Your sheet (example)
ชีตที่คุณส่ง (`gid=899542977`) มีคอลัมน์หลักที่ใช้ได้ตรง ๆ:
- `ประทับเวลา` (ใช้เป็นวันที่ของการบันทึก/มาเรียน)
- `เลขประจำตัวประชาชน` (ใช้เป็น unique คน — แนะนำที่สุด)
- `น้ำหนัก (กิโลกรัม)` + `ส่วนสูง (เซนติเมตร)` (คำนวณ BMI)
- `การวัดความดันโลหิต ครั้งที่ 1/2` (อ่านเป็น “120/80”)

หมายเหตุ: ชีตแบบ Google Form จะมี “หัวคอลัมน์ซ้ำ” หลายช่วง ระบบรองรับแล้วโดยจะเลือก “ค่าที่ไม่ว่างตัวแรก” ในแต่ละแถว

## Notes (Categories)
- **BMI**
  - สูตร: BMI = น้ำหนัก(กก.) / (ส่วนสูง(เมตร)²)
  - เกณฑ์:
    - < 18.5 = ผอม
    - 18.5–22.9 = ปกติ
    - 23.0–24.9 = ท้วม
    - 25.0–29.9 = อ้วนระดับ 1
    - ≥ 30.0 = อ้วนระดับ 2
  - ใน dashboard นี้: “เสี่ยง/ผิดปกติ” = ทุกสถานะที่ไม่ใช่ “ปกติ” (ยกเว้นค่าว่าง)

- **BP**
  - ปกติ: ตัวบน < 120 และตัวล่าง < 80
  - สูง: ตัวบน ≥ 140 หรือ ตัวล่าง ≥ 90
  - เสี่ยง: อื่น ๆ (เช่น 120–139 หรือ 80–89)
  - ใน UI: “เสี่ยง/ผิดปกติ” = เสี่ยง + สูง

- **Missing values**
  - ถ้าไม่มีน้ำหนัก/ส่วนสูง หรือ BP ไม่ครบ ระบบจะเป็น “ไม่ระบุ” และจะไม่นับเป็น “เสี่ยง”


