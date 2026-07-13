# Smart Light — ออกแบบ UI ใหม่ (เดสก์ท็อป 1a + มือถือ 2a)

วันที่: 2026-07-11
โมดูล: `smart-light` (เสาไฟสาธารณะ กองช่าง)
สเปกเดิม: `docs/superpowers/specs/2026-07-10-smart-light-design.md`
ที่มาของดีไซน์: mockup `Smart Light.dc.html` (design canvas)

## เป้าหมาย

Reskin หน้า `/admin/smart-light` ให้ตรงกับดีไซน์ธีมม่วงใหม่ (เดสก์ท็อป layout 1a + มือถือ flow 2a)
โดย**คงเอนจินแผนที่ Leaflet และการต่อ API เดิมไว้ทั้งหมด** เพิ่ม panel วิเคราะห์ที่คำนวณฝั่ง client

## ขอบเขต

- **ทำ:** งานหน้าตา (UI) ล้วน ๆ + ฟังก์ชัน `metrics.js` สำหรับคำนวณตัวเลขสรุป
- **ไม่ทำ (ยืนยัน):** ไม่แตะ API, ไม่แตะ model, ไม่เพิ่มฟิลด์เสา, ไม่มีหน้า public, ไม่มีใบสั่งซ่อม, ไม่มีการ fetch endpoint ใหม่
- Responsive: เดสก์ท็อป (≥1024px) แสดงแถบขวา / มือถือ (<1024px) ยุบเป็นแผนที่เต็มจอ + bottom sheet + การ์ดเสาใกล้ตัว
- ทุก panel ใหม่ผูกกับข้อมูลจริง (ไม่ใช่ placeholder)

## ข้อมูลที่มีอยู่ (ยืนยันความเป็นไปได้)

Panel ใหม่ทั้งหมดคำนวณฝั่ง client จาก 2 endpoint เดิม — ไม่ต้องแก้ backend

| Panel | แหล่งข้อมูล |
|---|---|
| โดนัทสุขภาพ (% ปกติ) | `GET /api/smart-light/groups` → `byStatus` |
| การ์ดสถานะ 2×2 | `GET /api/smart-light/groups` → `byStatus` |
| ค้างสำรวจนานสุด | `GET /api/smart-light/poles` → `lastSurveyedAt` |
| heatmap รายกลุ่ม | `GET /api/smart-light/groups` → `byStatus` + `centroid` |
| ตารางข้อมูล | `GET /api/smart-light/poles` |
| เสาใกล้ตัว (มือถือ) | `GET /api/smart-light/poles` + `haversineMeters` (มีอยู่แล้ว) |
| การ์ดรายละเอียด + ประวัติ | `GET /api/smart-light/poles/:id` (มีอยู่แล้ว) |

**รูปแบบ response ยืนยันแล้ว:**
- `GET /groups` → `[{ group, total, byStatus:{normal,damaged,off,unknown}, centroid:{lat,lng} }]`
- `GET /poles` → `[{ _id, code, name, group, lat, lng, status, lampType, lastSurveyedAt, ... }]` (ไม่รวม surveys)

## ระบบดีไซน์ (ใหม่)

ไฟล์ใหม่ `lib/smart-light/theme.js` — export object token สี/ระยะ ให้ panel และ modal ดึงชุดเดียวกัน

- **สีหลัก:** `#7C3AED` (primary), `#6D28D9` (primary-dark), `#EDE7FD`/`#F1ECFB` (soft), `#211B2E` (ink),
  `#57506A` (ink-2), `#8A8398` (muted), `#FAF8FF` (surface), `#E7E2F2` (line)
- **สีสถานะ:** ใช้ `POLE_STATUS[*].color` เดิม (`#16A34A`/`#F59E0B`/`#DC2626`/`#9CA3AF`) — mockup ใช้ชุดเดียวกัน
- **ฟอนต์:** `Anuphan` (หัวข้อ) + `IBM Plex Sans Thai` (เนื้อหา) โหลดผ่าน Google Fonts `<link>` ใน
  `next/head` ของหน้า apply ผ่าน wrapper class `.sl-root` เท่านั้น (ไม่กระทบหน้า admin อื่น)
- ใช้ inline style / Tailwind arbitrary values อ้างค่าจาก `theme.js` เพื่อความ match แม่นยำ

## เลย์เอาต์

### เดสก์ท็อป (≥1024px)
```
Header ม่วง: 💡 โลโก้ · ชื่อ · จำนวน+กลุ่มที่กรอง · ช่องค้นหา · [ตารางข้อมูล][กลุ่ม][＋ เพิ่มเสา]
┌───────────────────────────────┬──────────────────┐
│ แผนที่ (SmartLightMap)         │ แถบขวา 388px      │
│  · MapStatusChips (ลอยบน)      │  · HealthSummary  │
│  · ปุ่มซูม ± (ขวาล่าง)          │  · StatusCards    │
│  · การ์ดรายละเอียด (ซ้ายล่าง)   │  · OverdueCard    │
│                               │  · GroupHeatmap   │
└───────────────────────────────┴──────────────────┘
```

### มือถือ (<1024px)
- แถบขวายุบหาย → แผนที่เต็มจอ
- Header ม่วงมีชื่อ + chip สถานะเลื่อนแนวนอน
- การ์ด "เสาไฟใกล้คุณ" (`NearbyCard`) ลอยด้านล่าง — เสาในรัศมีจาก GPS
- แตะหมุด → `PoleBottomSheet` เต็มความกว้าง → กด "บันทึกสภาพ" เปิด `SurveyModal`
- เป็น flow 3 จอ (2a) โดยใช้ state การเลือกเดิม

## Component

### Reskin (logic/การต่อ API ไม่เปลี่ยน)
| Component | สิ่งที่เปลี่ยน |
|---|---|
| `SmartLightMap.js` | หมุด CircleMarker ได้ขอบขาว + วงแหวนตอนเลือก; bubble กลุ่ม + GeoJSON boundary คงเดิม |
| `PoleBottomSheet.js` | → การ์ดรายละเอียดลอย (เดสก์ท็อป) / bottom sheet (มือถือ) ธีมม่วง; ปุ่ม บันทึกสภาพ/นำทาง/แก้ไข |
| `SurveyModal.js` | Header ม่วง, ปุ่มสถานะใหญ่ 3 ปุ่ม, กล่องอัปโหลดรูปเส้นประ |
| `AddPoleModal.js` | ฟอร์มธีมม่วง (ตาม modal "เพิ่มเสาใหม่") |
| `EditPoleModal.js` | ปรับสีม่วงแบบเบา; เข้าถึงจากการ์ดรายละเอียด |
| `GroupRenameModal.js` | ปรับสีม่วงแบบเบา; เข้าถึงจากปุ่ม "กลุ่ม" บน header |
| `SearchPanel.js` | ย้าย logic ค้นหาไปไว้ใน pill ค้นหาบน header (dual-mode เดิม: `lat,lng` / ข้อความ) |

### Component ใหม่ (`components/smart-light/`)
- `RightRail.js` — คอนเทนเนอร์แถบขวา (เดสก์ท็อป) ประกอบการ์ดย่อย
- `HealthSummaryCard.js` — โดนัท conic-gradient (% ปกติ) + legend ปกติ/มีปัญหา/ยังไม่สำรวจ
- `StatusCards.js` — การ์ด 2×2 (ปกติ/ชำรุด/ดับ/ยังไม่สำรวจ) คลิกเพื่อ toggle `filterStatus`
- `OverdueCard.js` — เสาค้างสำรวจนานสุด top-N คลิก → ตั้ง `focusTarget` + เลือกเสา
- `GroupHeatmapCard.js` — grid ความหนาแน่นปัญหารายกลุ่ม คลิก → toggle `filterGroup` + บินไป centroid
- `DataTableModal.js` — ตารางเสาทั้งหมด (รหัส/กลุ่ม/สถานะ/สำรวจล่าสุด) เรียงคอลัมน์ได้ + ค้นหา; คลิกแถว → `focusTarget` + ปิด modal
- `MapStatusChips.js` — pill กรองสถานะลอยเหนือแผนที่ (แทน chip ใน top bar เดิม)
- `NearbyCard.js` — รายการเสาใกล้ตัว (มือถือ) ใช้ `haversineMeters`

## การคำนวณข้อมูล (ใหม่ — pure function ทดสอบได้)

ไฟล์ใหม่ `lib/smart-light/metrics.js` — ฟังก์ชันบริสุทธิ์ รับข้อมูลที่ fetch มาแล้ว ไม่มี side effect

```
daysSince(dateLike, now?) → number | null
  // null ถ้า date ว่าง/ไม่ถูกต้อง; ไม่งั้นคืนจำนวนวันเต็ม (floor) จาก now

healthSummary(groups) → { total, normal, problem, unknown, pct }
  // problem = damaged + off; pct = round(normal / total * 100) (0 ถ้า total=0)

overduePoles(poles, n, now?) → [{ ...pole, days: number|null, daysLabel: string }]
  // เรียง: ยังไม่เคยสำรวจ (days=null) มาก่อน จากนั้น days มาก→น้อย; เอา n ตัวแรก
  // daysLabel: "ยังไม่เคยสำรวจ" ถ้า null, ไม่งั้น "<days> วันก่อน"

groupHeat(groups) → [{ name, total, problem, ratio, centroid }]
  // problem = damaged + off; ratio = problem/total (0 ถ้า total=0); เรียงตาม ratio มาก→น้อย
```

Panel และ table modal เรียกใช้ฟังก์ชันเหล่านี้ ไม่คำนวณเอง

## State & data flow

คงเดิมทั้งหมด — หน้าเพจใช้ React hooks เดิม (`poles`, `groups`, `boundaries`, `filterGroup`,
`filterStatus`, `selectedPole`, flag ของ modal, `focusTarget`)

- Panel ใหม่เป็น **derived state** จาก `poles`/`groups` ผ่าน `metrics.js` — **ไม่มี fetch ใหม่**
- คลิกการ์ด/แถว/tile → ตั้งค่า `filterStatus` / `filterGroup` / `focusTarget` โดยใช้ wiring เดิม
- `DataTableModal` เพิ่ม flag `tableOpen` (pattern เดียวกับ modal อื่น)
- หลัง action (survey/add/edit/rename) เรียก `loadAll()` เดิม → panel คำนวณใหม่อัตโนมัติ

## การจัดการ error/edge case

- `total = 0` (ไม่มีเสา): โดนัท 0%, การ์ด 0, ลิสต์ว่างพร้อมข้อความ "ยังไม่มีข้อมูล"
- เสายังไม่เคยสำรวจ (`lastSurveyedAt` ว่าง): แสดง "ยังไม่เคยสำรวจ", จัดบนสุดของ overdue
- โหลดล้มเหลว: คง error alert + ปุ่ม retry เดิม; panel ไม่ render ถ้า `groups`/`poles` ว่าง
- มือถือไม่มี GPS/ปฏิเสธสิทธิ์: `NearbyCard` แสดงข้อความให้เปิดตำแหน่ง (ไม่ crash)

## การทดสอบ

- **Unit test** `lib/smart-light/__tests__/metrics.test.mjs` — repo ไม่มี test runner จึงเขียนเป็น
  สคริปต์ `node` ใช้ `node:assert` รันด้วย `node lib/smart-light/__tests__/metrics.test.mjs`
  ครอบคลุม: total=0, เสาไม่เคยสำรวจ, การเรียง overdue, การเรียง groupHeat, การคำนวณ pct/ratio
- **Manual checklist** อัปเดต `docs/modules/smart-light.md`:
  - เดสก์ท็อป: header/แผนที่/แถบขวา 4 การ์ด แสดงตัวเลขตรงกับ chip
  - คลิก StatusCard/heatmap/overdue → กรอง+โฟกัสถูกต้อง
  - ตารางข้อมูล: เรียงคอลัมน์, ค้นหา, คลิกแถวโฟกัสบนแผนที่
  - Responsive: ย่อจอ <1024px → แถบขวาหาย, chip เลื่อนแนวนอน, การ์ดเสาใกล้ตัวโผล่
  - มือถือ: แตะหมุด→bottom sheet→บันทึกสภาพ; ฟอนต์ Anuphan/IBM Plex โหลด
  - แผนที่เดิมยังทำงาน: 2-level zoom, boundary อยู่หลังหมุด, เพิ่ม/แก้/ลบ/นำทาง

## ไฟล์ที่แตะ

**ใหม่:**
- `lib/smart-light/theme.js`
- `lib/smart-light/metrics.js`
- `lib/smart-light/__tests__/metrics.test.mjs`
- `components/smart-light/RightRail.js`
- `components/smart-light/HealthSummaryCard.js`
- `components/smart-light/StatusCards.js`
- `components/smart-light/OverdueCard.js`
- `components/smart-light/GroupHeatmapCard.js`
- `components/smart-light/DataTableModal.js`
- `components/smart-light/MapStatusChips.js`
- `components/smart-light/NearbyCard.js`

**แก้ (reskin):**
- `pages/admin/smart-light.jsx` (layout shell + wiring panel ใหม่)
- `components/smart-light/SmartLightMap.js` (สไตล์หมุด)
- `components/smart-light/PoleBottomSheet.js`
- `components/smart-light/SurveyModal.js`
- `components/smart-light/AddPoleModal.js`
- `components/smart-light/EditPoleModal.js`
- `components/smart-light/GroupRenameModal.js`
- `components/smart-light/SearchPanel.js`
- `docs/modules/smart-light.md` (checklist)

**ไม่แตะ:** ทุกไฟล์ใน `pages/api/smart-light/`, `models/smart-light/`, `lib/smart-light/{constants,geo,poleCode,uploadImage}.js`
