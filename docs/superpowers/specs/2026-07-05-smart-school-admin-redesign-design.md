# Smart School Admin — รีดีไซน์ธีมม่วง-ครีม (Design Spec)

**วันที่:** 2026-07-05
**สถานะ:** อนุมัติแนวทางแล้ว รอรีวิว spec
**ที่มา:** `design_handoff_smart_school/` (README + `Smart School Redesign.dc.html`) — mockup hi-fi ที่ผู้ใช้ทำไว้ ให้ recreate เป็นของจริงในโมดูล `smart-school`

## Goal
ปรับหน้า admin ของโมดูล smart-school (`/admin/smart-school`) ให้เป็นธีม **ม่วง-ครีม "หรูแต่เข้าถึงง่าย"** ตาม handoff — ให้เข้าชุดเดียวกับฟอร์ม survey ที่รีดีไซน์ไปแล้ว (branch `smart-school`, commit 768fcb2)

## แนวทาง (ยืนยันกับผู้ใช้แล้ว)
- **Re-theme + ปรับเลย์เอาต์** โครงสร้าง admin 4 แท็บเดิม ไม่สร้างใหม่จากศูนย์ (โครง 4 แท็บ + MapPoints + modal มีอยู่แล้ว)
- **ใช้โทเคนจาก `surveyTheme.jsx` ซ้ำ** (สี/ฟอนต์/`inputCls`/`labelCls`/`chipCls`/ปุ่ม) + เพิ่ม `adminTheme.jsx` สำหรับ helper เฉพาะ dashboard (การ์ด shell, stat card, pill tab, badge สถานะ, table header)
- **ปรับ mockup → ข้อมูลจริง**: mockup มีข้อมูล/ฟีเจอร์ปลอมบางอย่างที่ระบบจริงไม่มี → ตัดออกหรือแทนด้วยของจริง (ดู "การปรับ mockup→จริง")
- **ทยอยเป็นเฟส** (3 เฟส) — เฟส 1 ส่งผลเร็วสุด
- **ไม่แตะ API/โมเดล**: [list.js](pages/api/smart-school/list.js) ส่ง `stats.byStatus` + fields ครบแล้ว; endpoint status/update/rank/blocked-schools มีครบ

## Design Tokens (จาก handoff — ตรงกับ surveyTheme.jsx อยู่แล้ว)
**สี**
- Accent ม่วงหลัก `#7C3AED` · hover/deep `#6D28D9` · เข้มพิเศษ `#5B21B6`
- ม่วงอ่อน (พื้นชิป/ไฮไลต์): `#EDE7FD` `#F1ECFB` `#F6F3FD` `#DDD2FB`
- พื้นการ์ด `#FAF8FF` · พื้นหน้า/แคนวาส `#ECEAF3` · เส้นขอบ `#E7E2F2` / `#F0ECF8`
- ตัวอักษรเข้ม `#211B2E` / `#1A1523` · รอง `#57506A` · จาง `#8A8398` · placeholder `#B9B0C9`
- **status color map** (สถานะจริง 4 ค่า):
  - `รับคำร้อง` → bg `#EDE7FD` text `#6D28D9` (ม่วงอ่อน)
  - `ตรวจสอบแล้ว` → bg `#DDD2FB` text `#6D28D9` (ม่วงเข้มขึ้น)
  - `ได้รับทุน` → bg `#DCFCE7` text `#15803D` (เขียว)
  - `ไม่ผ่านเกณฑ์` → bg `#F1F1F4` text `#6B7280` (เทา)
  - flag เตือน (บ้านเดียวกัน/เกินโควตา) → bg `#FEF3C7` text `#B45309` (เหลือง); อันตราย bg `#FEE2E2` text `#B91C1C` (แดง)

**ฟอนต์**: `FONT_DISPLAY` (Anuphan) หัว/ตัวเลข · `FONT_BODY` (IBM Plex Sans Thai) เนื้อหา — โหลดแล้วใน `pages/_document.tsx`
**Radius**: การ์ดใหญ่ 24px · การ์ด/ชิปเล็ก 12–18px · ชิป/pill 999px
**Shadow**: การ์ด `0 20px 50px -30px rgba(33,27,46,.4)` · ปุ่ม accent `0 12px 24px -10px rgba(124,58,237,.6)`

## Theme foundation — `components/smart-school/adminTheme.jsx` (ใหม่)
Import สี/ฟอนต์/`inputCls`/`labelCls`/`chipCls`/`primaryBtnCls`/`ghostBtnCls` จาก `surveyTheme.jsx` (source of truth เดียว) แล้ว export helper เฉพาะ admin:
- `cardCls` — การ์ด shell: `bg-[#FAF8FF] border border-[#E7E2F2] rounded-[24px] shadow-[0_20px_50px_-30px_rgba(33,27,46,0.4)]`
- `StatCard({ value, label, tone })` — การ์ดสถิติ (`tone`: purple-filled / default / colored value)
- `PillTabs({ tabs, active, onChange })` — แถบแท็บ pill ม่วง (พื้น `#F1ECFB`, active = การ์ดขาว + เงา + ตัวม่วง)
- `statusBadgeCls(status)` — คืน class ตาม status color map
- `DashboardHeader({ year, years, onYearChange })` — หัว dashboard (ไอคอน 📚 + ชื่อ + ตัวเลือกปีงบ)

> เหตุผลไม่รวมเข้า surveyTheme.jsx: surveyTheme คุมสเกลมือถือ (text-16px กัน iOS zoom); admin เป็นจอใหญ่ helper คนละชุด แต่ยัง import สี/ฟอนต์จากที่เดียวกัน

---

## เฟส 1 — Shell + แท็บตาราง + Modal ดู/แก้ไข

### 1.1 Dashboard shell + การ์ดสถิติ — `SmartSchoolDashboard.jsx`
> หมายเหตุ: dashboard **มีอยู่แล้ว** — fetch `list.js` → `{ year, years, applications, stats }`, render ตัวเลือกปีงบ (yearTabs, บรรทัด ~85), **การ์ดสถิติ 6 ใบ** (บรรทัด ~105–113, label ตรงกับด้านล่างเป๊ะ), และแท็บ 4 view. งานคือ **restyle in place** ไม่ใช่สร้างใหม่
- แทนหัว/แถบปุ่ม `join` เดิมด้วย `DashboardHeader` + `PillTabs`
- Header: ไอคอน 📚 (กล่องม่วง 44px rounded-14) + "Smart School — สำรวจการศึกษา" (FONT_DISPLAY 19px bold) + subtitle "ทะเบียนผู้ขอทุน + แบบสำรวจรายปีงบประมาณ" + ตัวเลือกปีงบ (pill จาก `yearTabs` ที่มีอยู่ — restyle ปุ่ม `btn` เดิมเป็น pill ม่วง)
- แท็บ (คงชื่อ view เดิม `table|map|blocked|allocation`): `📋 ตาราง · 🗺️ แผนที่ · 🚫 โรงเรียนไม่ผ่าน · 🎯 จัดสรรทุน`
- **การ์ดสถิติ 6 ใบ** (คงตำแหน่งใน dashboard, restyle เป็น `StatCard` grid 6→2/3 บนจอเล็ก): ทั้งหมด (`stats.total`, การ์ดม่วงเต็ม) · รายเก่า (`stats.renewals`) · รับคำร้อง · ตรวจสอบแล้ว (ตัวเลขม่วงเข้ม) · ได้รับทุน (เขียว) · ไม่ผ่านเกณฑ์ (เทา) — จาก `stats.byStatus`. คงการ gate ให้โชว์บนแท็บตาราง (ตาม mockup)
- พื้นหน้า wrapper เป็น `#ECEAF3` (หรือคง bg เดิมของ LayoutAdmin ถ้าชนกัน — ใช้ card shell ครอบเนื้อหาแทน)

### 1.2 แท็บตาราง — `ApplicationTable.jsx`
- **ตัวกรอง**: คงตัวกรองระดับเดิม (level tabs) แต่เปลี่ยนสไตล์เป็น `chipCls` + คงช่องค้นหาเดิม (ชื่อ/รหัส) สไตล์ `inputCls`
- **ตาราง**: แต่งใหม่ด้วย card shell + header พื้น `#F6F3FD` · แถวคลิกได้ (`cursor-pointer`, hover `#F6F3FD`) → เปิด detail modal · badge "เก่า" (isRenewal) เหลือง · 🏠 บ้านเดียวกัน (household.members) · สถานะใช้ `statusBadgeCls` · คงคอลัมน์เดิม + badge เกณฑ์ (schoolEligibility/residency) ที่มีอยู่
- คงลอจิกกรอง/ค้นหา/เปิด modal เดิมทั้งหมด เปลี่ยนแค่ชั้น presentation

### 1.3 Modal ดู/แก้ไข — `ApplicationDetailModal.jsx` + `ApplicationEditModal.jsx`
- **ดู (Detail)**: หัวม่วง (`#7C3AED`) + ไอคอน + code + ชื่อ + badge สถานะ + ปุ่มปิด ✕ · เนื้อหาแบ่งกลุ่มหัวข้อสีม่วง (ข้อมูลการศึกษา / ครัวเรือน&รายได้ / รูป 3 + พิกัด) · คงทุกฟิลด์เดิม (เกณฑ์ eligibility, residency, checklist, scholarshipAmount, scholarshipRank, household members) · ปุ่มล่าง "ปิด" (ghost) + "✎ แก้ไขข้อมูล" (primary)
- **แก้ไข (Edit)**: หัวเข้ม (`#211B2E`) + ไอคอน ✎ · chip สถานะ 4 ค่า (`chipCls`) · ฟิลด์ `inputCls`/`labelCls` · คงฟิลด์แก้ไขเดิมครบ (schoolEligibility/residency/checklist/ชื่อ/รายได้/ผู้ปกครอง/หมายเหตุ) · ปุ่ม "ยกเลิก" (ghost) + "✓ บันทึกการแก้ไข" (success) · toast สำเร็จ 2.2s (คงกลไก Swal/toast เดิมหรือใช้ toast ม่วง)

---

## เฟส 2 — แท็บจัดสรรทุน — `AllocationBoard.jsx`
คงตารางลำดับที่ทำไว้ (rank input + ปุ่ม OK + ตัวกรองโรงเรียน + แท็บระดับ + Export CSV) — **เพิ่ม/แต่ง**:
- **การ์ดโควตา progress ต่อระดับ** (grid) ด้านบน: ระดับ + `awarded/quota` + progress bar (ม่วง; **แดงเต็มแถบเมื่อ awarded > quota**) — ดึงจาก `SCHOLARSHIP_LEVELS` + นับ awarded ต่อ bucket ที่มีอยู่แล้วใน component
- แต่งตาราง/แท็บ/ปุ่ม เป็นธีมม่วง (`cardCls`, `chipCls`, `statusBadgeCls`) · badge 🏠 เตือนบ้านเดียวกัน/เกินโควตา เหลือง
- **ไม่ทำ** 2 คอลัมน์ selected/candidate ตาม mockup (ผู้ใช้เลือกคงตารางลำดับ)

---

## เฟส 3 — แท็บแผนที่ + โรงเรียนไม่ผ่าน
### 3.1 แผนที่ — `MapPoints.js` (+ ที่ render ใน `SmartSchoolDashboard.jsx`)
- ครอบด้วย `cardCls` + หัว "🗺️ แผนที่ผู้สมัคร" + จำนวนหมุด
- **panel กรองด้านซ้าย** (checkbox สถานะ + chip ระดับ) + **legend สีหมุดตามสถานะ** (ม่วง=รับคำร้อง, ม่วงเข้ม=ตรวจแล้ว, เขียว=ได้ทุน, เทา=ไม่ผ่าน) — ใช้สีจาก status map
- คง Leaflet/marker/logic เดิม เปลี่ยนสีหมุด + กรอบ + เพิ่ม panel/legend

### 3.2 โรงเรียนไม่ผ่าน — `BlockedSchoolsPanel.jsx`
- **คงการจัดการ blocklist โรงเรียน** (เพิ่ม/แก้/ลบ ชื่อโรงเรียนเอกชน/นอกเขต) — แต่งธีมม่วงเท่านั้น (`cardCls`/`inputCls`/`chipCls`/ปุ่ม)

---

## การปรับ mockup → จริง (สำคัญ — กัน scope creep)
| mockup | ของจริง / การปรับ |
|---|---|
| แท็บที่ 3 "🚫 เรียนโรงเรียนเอกชน" แสดง**ผู้สมัครไม่ผ่าน+เหตุผล** | คงเป็น **จัดการ blocklist โรงเรียน** (ผู้ใช้เลือก) — ไม่ทำหน้ารายชื่อผู้ไม่ผ่าน |
| แท็บจัดสรร: 2 คอลัมน์ selected/candidate pool | คง **ตารางลำดับ (rank)** เดิม + การ์ดโควตา |
| สถานะ mockup 6 แบบ (รับคำร้อง/ตรวจ/รับคำร้อง/ครวจสอบแล้ว/ได้ทุน/ไม่ผ่าน) | สถานะจริง **4 ค่า** — การ์ดสถิติเพิ่ม "ทั้งหมด" + "รายเก่า" ให้ครบ 6 ใบ |
| เลข/ชื่อ/โควตาใน mockup (เช่น 12/20, มัธยม 8/15) | ดึงจากข้อมูลจริง + `SCHOLARSHIP_LEVELS` (อนุบาล35/ประถม80/ม.ต้น50/ม.ปลาย20/ป.ตรี10) |
| tooltip แผนที่ "ดูรายละเอียด/Street View" | คงปุ่ม/ลิงก์เท่าที่มีข้อมูลจริง (พิกัด → Google Maps); ไม่เพิ่ม Street View ถ้าไม่มี |
| success/toast, animation | ใช้กลไก toast/Swal เดิมของ admin |

## ไฟล์ที่แตะ (สรุป)
- **ใหม่**: `components/smart-school/adminTheme.jsx`
- **เฟส 1**: `SmartSchoolDashboard.jsx`, `ApplicationTable.jsx`, `ApplicationDetailModal.jsx`, `ApplicationEditModal.jsx`
- **เฟส 2**: `AllocationBoard.jsx`
- **เฟส 3**: `MapPoints.js`, `BlockedSchoolsPanel.jsx`, (แผนที่ render ใน `SmartSchoolDashboard.jsx`)
- **ไม่แตะ**: API, models, permissions, `pages/admin/smart-school.jsx` (`stats`/`years` ไหลถึง dashboard ผ่าน `list.js` อยู่แล้ว)

## Non-goals / Out of scope
- ไม่เพิ่ม API/field/collection ใหม่
- ไม่ทำหน้า "รายชื่อผู้ไม่ผ่าน + เหตุผล" (mockup) — คง blocklist
- ไม่แตะฟอร์ม survey (รีดีไซน์แล้ว) และไม่แตะธีม daisyUI รวมของทั้งเว็บ (จำกัดสไตล์ในโมดูล smart-school)
- ไม่เพิ่มฟีเจอร์ใหม่ที่ mockup โชว์แต่ไม่มีข้อมูลรองรับ (candidate pool, Street View)

## Verification (ไม่มี test runner)
- `npm run lint` + `npm run build` เขียวทุกเฟส
- เดิน dev server `/admin/smart-school` ตรวจแต่ละแท็บด้วยตา (มี data จริงปี 2568 ในระบบแล้ว)
