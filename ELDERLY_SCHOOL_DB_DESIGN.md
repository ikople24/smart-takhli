# Elderly School (MongoDB Design)

## Goal
เก็บข้อมูลโรงเรียนผู้สูงอายุลง MongoDB ของระบบเอง โดยแยกเป็น “รายปี” และแก้ไขข้อมูลรายบุคคล/รายครั้งได้

แนวคิดหลัก:
- 1 คน = 1 เรคคอร์ดใน `elderly_people`
- 1 คน / 1 ปี / 1 ครั้ง (1–16) = 1 เรคคอร์ดใน `elderly_visits`

## Collections

### 1) `elderly_people`
เก็บข้อมูลประจำตัว (แก้ได้โดยไม่กระทบข้อมูลการวัด)
- `citizenId` (string, unique)
- `fullName` (string)
- `ageYears` (number | null)
- `birthDateText` (string | null) เก็บตาม sheet
- `bloodType`, `phone`, `address`, `occupation` (string | null)
- `heightCm` (number | null) ส่วนสูงมักคงที่
- `sourceYearFirstSeen` (number | null) เช่น 2568
- `createdAt`, `updatedAt`

### 2) `elderly_visits`
เก็บข้อมูลการมาเรียน/การวัดรายครั้ง
- `personId` (ObjectId → `elderly_people`)
- `yearBE` (number) เช่น 2568, 2569
- `visitNo` (1..16)
- `measuredAt` (Date | null) *ไม่บังคับ เพราะ sheet อาจกรอกย้อนหลัง*
- ค่าวัด: `weightKg`, `waistCm`, `pulseBpm`, `bp1Sys/bp1Dia`, `bp2Sys/bp2Dia`, `heightCm`
- unique index: `{ personId, yearBE, visitNo }`

## “ครั้งล่าสุด” ในระบบ
ในแต่ละปี จะหมายถึง “visitNo ที่มากที่สุดที่มีข้อมูล” ของคนนั้นในปีนั้น

## Import workflow (ต่อปี)
เรียก API import พร้อมระบุปี:
- Preview: ตรวจจำนวนแถว/จำนวนคน/จำนวน visit ก่อน
- Import: upsert คน + upsert visit เฉพาะครั้งที่มีข้อมูล

## APIs (Smart-Health)
- `POST /api/smart-health/elderly/import` (ปี+csvUrl, รองรับ dryRun)
- `GET /api/smart-health/elderly/dashboard?yearBE=2568&visit=latest&includePeople=1`
- `GET/PUT /api/smart-health/elderly/people`
- `GET/POST/PUT /api/smart-health/elderly/visits`

## UI
- หน้า dashboard เลือกปี + เลือกครั้งล่าสุด/ครั้งที่ 1–16
- แสดงสรุป BMI/BP + ตารางรายชื่อเสี่ยง
- มีส่วน “นำเข้าข้อมูลรายปี” (วาง CSV URL + เลือกปี)
- กด “ดู/แก้ไข” รายคน → แก้ข้อมูลคน และแก้แต่ละครั้ง (1–16)


