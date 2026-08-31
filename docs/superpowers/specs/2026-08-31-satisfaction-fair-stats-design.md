# ดีไซน์: สถิติความพึงพอใจแบบ "1 ผู้แจ้ง = 1 เสียง" + บังคับโควตาฝั่ง server

วันที่: 2026-08-31 · สถานะ: อนุมัติแล้ว · โมดูล: satisfaction (`docs/modules/satisfaction.md`) · branch: `satisfaction-fair-stats`

## ปัญหา

การ์ด "ความพึงพอใจ" บน `/admin/dashboard` และ "x / 5" บน `/admin/analytics`
คำนวณจาก**ค่าเฉลี่ยของทุกแถว**ใน `satisfactions` — 1 คะแนน = 1 เสียง
ผู้แจ้งคนเดียวที่ยื่นเรื่องเดิมซ้ำหลายใบแล้วให้ 1 ดาวทุกใบจึงถ่วงตัวเลขทั้งระบบได้

ข้อมูลจริง ณ วันเขียน (อ่านอย่างเดียว):

| | จำนวนคะแนน | เฉลี่ย | % |
|---|---|---|---|
| ทั้งระบบ | 59 | 4.41 | 88.1% |
| ไม่รวมผู้แจ้ง 1 ราย (7 เรื่อง เฉลี่ย 2.14) | 50 | 4.86 | 97.2% |

คะแนน ≤ 2 ดาวทั้ง 7 แถวในระบบมาจากเรื่องของผู้แจ้งรายเดียว

จุดอ่อนที่พบระหว่างสำรวจ: โควตา "4 ครั้ง/เรื่อง" ของช่องทางเว็บเช็ค**ฝั่ง client
เท่านั้น** (`pages/status/[id].tsx` `MAX_RATINGS = 4`) — `recordPublicRating`
ใน `lib/satisfaction/record.js` ไม่จำกัดจำนวน ยิง `POST /api/satisfaction/create`
ตรง ๆ ได้ไม่อั้น

## หลักการ

- **ไม่มีกรณีพิเศษต่อบุคคล** — ไม่บล็อก ไม่ลบ ไม่ซ่อนคะแนนใคร เปลี่ยนเฉพาะ
  กติกานับให้ทุกคนมีน้ำหนักเท่ากัน (เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชน 10 เรื่อง
  ก็ยุบเป็น 1 เสียงเช่นกัน — กติกาสมมาตร)
- **โปร่งใส** — ตัวเลขดิบ (จำนวนครั้ง, เฉลี่ยดิบ, histogram รายดาว) ยังแสดงอยู่
  ผู้บริหารอธิบายได้ประโยคเดียว: "นับต่อผู้แจ้ง ไม่นับต่อครั้ง"
- **ไม่แก้ข้อมูล** — เป็นการเปลี่ยนวิธีอ่าน + เพิ่มด่านฝั่งเขียน ไม่มี migration

## นอกสโคป (เฟส 2 — brainstorm แยก)

- ผูกเรื่องซ้ำเข้าเรื่องแม่ (`duplicateOf`) และการตรวจจับเรื่องซ้ำตอนยื่น
- สถานะ "ติดตามต่อเนื่อง" — ตัดออก ไม่ทำ
- `pages/api/tasks/pending.ts` (อ่าน `Satisfaction` ด้วย model `Complaint` เก่า —
  legacy คนละเรื่อง), `by-complaint.js` (ไม่มี caller)

## ส่วนที่ 1 — กติกาคำนวณ (`lib/satisfaction/fairStats.js`, logic ล้วน)

ไฟล์นี้**ห้ามมี I/O** — เทสด้วย vitest แบบเดียวกับ `lib/satisfaction/lineRating.js`

### อินพุต

```
ratings:  [{ complaintId, rating, source, createdAt }]      ← แถว satisfactions (complaintId เป็น string)
reports:  Map<complaintId, { phone, lineUserId }>            ← จาก submittedreports เฉพาะเรื่องที่มีคะแนน
```

### ตัวระบุผู้แจ้ง `reporterKey(report, complaintId)`

ลำดับ fallback — คีย์มี prefix กันชนกันข้ามชนิด:

1. `tel:<digits>` — `phone` ตัดทุกอักขระที่ไม่ใช่ตัวเลข (`replace(/\D/g, "")`)
   จัดการช่องว่างท้าย/ขีดกลางที่พบในข้อมูลจริง · **ไม่เติมเลข 0** ให้เบอร์ 9 หลัก
   (ปล่อยเป็นคนละคน — 4/513 เรื่อง ยอมรับได้)
2. เบอร์ว่าง → `line:<lineUserId>`
3. ไม่มีทั้งคู่ หรือ `report` ไม่อยู่ใน Map (เรื่องถูกลบ) → `complaint:<complaintId>`
   (เรื่องนั้นเป็นเสียงของตัวเอง ไม่หายจากสถิติ)

### 3 ขั้น

1. **ต่อเรื่อง** — จับกลุ่มด้วย `complaintId` → เฉลี่ยคะแนนในเรื่อง → 1 เรื่อง = 1 ค่า
   (กดซ้ำ/ปั่นโควตาในเรื่องเดียวไม่มีน้ำหนักเพิ่ม)
2. **ต่อผู้แจ้ง** — จับกลุ่มค่าจากขั้น 1 ด้วย `reporterKey` → เฉลี่ย → 1 ผู้แจ้ง = 1 ค่า
3. **รวม** — เฉลี่ยค่าจากขั้น 2 ทุกผู้แจ้ง → `averageRating`

### เอาต์พุต `computeFairStats(ratings, reports)`

รูปเดิมของ `GET /api/satisfaction/stats` + ฟิลด์ใหม่ (`averageRating` **เปลี่ยนความหมาย**
เป็นค่าต่อผู้แจ้ง):

| ฟิลด์ | ค่า (ข้อมูลจริง) | หมายเหตุ |
|---|---|---|
| `averageRating` | 4.85 | **ค่าใหม่** ต่อผู้แจ้ง — ใช้ทำ headline % และดาว |
| `reporters` | 24 | จำนวนผู้แจ้ง (จำนวน `reporterKey` ที่ต่างกัน — เจ้าของเรื่องที่มีคะแนน ไม่ใช่คนกดดาว) |
| `ratedComplaints` | 49 | จำนวนเรื่องที่มีคะแนน |
| `totalRatings` | 59 | เดิม — จำนวนครั้ง |
| `rawAverage` | 4.41 | เฉลี่ยดิบแบบเดิม — บรรทัดเล็กเพื่อความโปร่งใส |
| `ratingDistribution` | `{1:7, 2:0, …}` | **คงเป็นจำนวนครั้งดิบ** — แถบ 1 ดาวยังเห็นว่ามี 7 ครั้งจริง |
| `bySource` | เดิม (ดิบ) | `public`/`line` × `{count, average}` — บรรทัด "จากผู้ที่ผูก LINE…" ไม่เปลี่ยน · แถวไม่มี `source` นับเป็น `public` เหมือนเดิม |
| `method` | `"per-reporter"` | ให้ client/คนอ่าน API รู้ว่าเลขนี้นับแบบไหน |

ไม่มีคะแนนเลย → `averageRating: 0, rawAverage: 0, reporters: 0, ratedComplaints: 0,
totalRatings: 0`, distribution ศูนย์ทุกดาว, `bySource` ศูนย์ (พฤติกรรมเดิม)

ผลกับข้อมูลจริง: **88.1% → 97.1%** (24 ผู้แจ้ง)

### กราฟรายสัปดาห์

`GET /api/analytics/satisfaction?days=` เลิกใช้ aggregate `$isoWeek` — ดึงแถวในช่วง
แล้วแบ่งถังใน JS ด้วย helper ล้วน `isoWeekKey(date)` (`lib/satisfaction/isoWeek.js`)
→ `{ year, week, label: "2026-W35" }` คิดบนเวลา **Asia/Bangkok** แบบไม่พึ่ง TZ ของเครื่อง:
เลื่อน timestamp +7 ชม. แล้วใช้ UTC getters คำนวณ ISO week (Bangkok ไม่มี DST จึงเลื่อนคงที่ได้)
แล้วเรียก `computeFairStats` ต่อถัง:

```
weeklyTrend[]: { year, week, label, avgRating (ต่อผู้แจ้ง, ปัด 2 ตำแหน่ง), count (ครั้งดิบ), reporters }
```

ชื่อฟิลด์ `avgRating`/`count`/`label` คงเดิม → component กราฟไม่ต้องแก้ ·
`distribution` รายดาวของช่วงเวลา ยังเป็นจำนวนครั้งดิบเหมือนเดิม

### กรณีขอบ

- ขนาดข้อมูล ~500 เรื่อง / ~60 คะแนน → ทำใน JS ด้วย 2 query ไม่ใช้ `$lookup`
- เบอร์เดียวมีหลายชื่อ (สะกดต่างกัน) → คนเดียวกันตามเบอร์ — ตั้งใจ
- เรื่องลับ (`isConfidential`) ยังมี `phone` ในฐานข้อมูล → ใช้เป็นคีย์ได้ปกติ
  (คีย์ไม่ออกจาก server — API คืนแค่จำนวน)

## ส่วนที่ 2 — จุดที่แตะ

### A. ชั้นอ่าน (I/O helper ใหม่) `lib/satisfaction/readStats.js`

```
loadSatisfactionStats({ from } = {})
  → Satisfaction.find(from ? { createdAt: { $gte: from } } : {})
      .select("complaintId rating source createdAt").lean()
  → SubmittedReport.find({ _id: { $in: <complaintIds ที่ต่างกัน> } })
      .select("_id phone lineUserId").lean()   → Map
  → { ratings, reports }   ← ให้ endpoint เรียก computeFairStats / แบ่งถังเอง
```

ผู้ใช้ 3 endpoint (ตรงกับ roadmap "การอ่านยังไม่รวมศูนย์" ใน `satisfaction.md`):

| endpoint | เดิม | ใหม่ |
|---|---|---|
| `pages/api/satisfaction/stats.js` | `find` ทุกแถว + วนรวมเอง | `loadSatisfactionStats()` → `computeFairStats` → คืนรูปเอาต์พุตข้างบน |
| `pages/api/analytics/summary.ts` | `aggregate $avg` ดิบ | `loadSatisfactionStats()` → `computeFairStats` → `avgSatisfaction` = `averageRating` (ปัด 2), `totalRatings` เดิม, เพิ่ม `satisfactionReporters` |
| `pages/api/analytics/satisfaction.ts` | `aggregate $isoWeek` | `loadSatisfactionStats({ from })` → แบ่งถัง `isoWeekKey` → `computeFairStats` ต่อถัง |

auth ของทั้ง 3 endpoint คงเดิม (stats.js เปิดสาธารณะอยู่แล้วและคืนแค่ตัวเลขรวม —
ไม่มี `reporterKey`/เบอร์ออกไป)

### B. หน้าจอ

- `pages/admin/dashboard.jsx` การ์ด "ความพึงพอใจ": headline `%` และดาวใช้
  `averageRating` (ค่าใหม่) · เพิ่มบรรทัดเล็ก **"ทุกช่วงเวลา · ผู้แจ้ง 24 ราย · 59 คะแนน ·
  เฉลี่ยดิบ 4.4 / 5"** (ระบุ "ทุกช่วงเวลา" เพราะการ์ดอื่นในกริดกรองตามปีงบ · ใส่ "/ 5" ให้เทียบสเกลกับ headline % ได้) เหนือบรรทัด LINE เดิม · `calculateStats` เก็บ `reporters`,
  `totalRatings`, `rawAverage` เพิ่ม
- `pages/admin/analytics.tsx`: การ์ด "4.85 / 5" + subtitle "ผู้แจ้ง 24 ราย · 59 การประเมิน" ·
  กราฟรายสัปดาห์รับค่าใหม่โดยไม่แก้ component

### C. โควตาฝั่ง server

- `lib/satisfaction/quota.js` (logic ล้วน): `MAX_PUBLIC_RATINGS_PER_COMPLAINT = 4`,
  `isPublicQuotaFull(count)` → `count >= MAX`
- `pages/status/[id].tsx`: ลบ `MAX_RATINGS = 4` → import ค่าคงที่จาก `quota.js`
- `lib/satisfaction/record.js#recordPublicRating`: หลังผ่าน `not_found`/`not_closed`
  → `Satisfaction.countDocuments({ complaintId, source: { $ne: "line" } })`
  (เงื่อนไขเดียวกับ `count.js` — แถวเก่าไม่มี `source` นับเป็น public) →
  `isPublicQuotaFull` → คืน `{ ok: false, reason: "quota_exceeded" }`
- `pages/api/satisfaction/create.js`: `quota_exceeded` → **HTTP 429**
  `{ success: false, message: "เรื่องนี้ได้รับการประเมินครบ 4 ครั้งแล้ว" }`
  (ข้อความสร้างจากค่าคงที่ ไม่ hardcode เลข 4)
- `components/SatisfactionForm.js`: อ่าน `message` จาก response body ถ้ามี แสดงแทน
  "ไม่สามารถส่งความคิดเห็นได้" · เพิ่ม prop ใหม่ `onQuotaFull?()` เรียกเมื่อได้ 429
  (**ไม่**เรียก `onSubmit` — ตัวนั้นบวก `ratingCount` +1 ฝั่ง client ซึ่งผิดความหมาย)
- `pages/status/[id].tsx`: ส่ง `onQuotaFull` → refetch `GET /api/satisfaction/count?…&source=public`
  แล้ว `setRatingCount` ใหม่ → `ratable` เป็น false ฟอร์มซ่อน แสดงป้าย "ครบ 4 ครั้ง" ตามเดิม
- ช่องโหว่ที่ยอมรับ: สองคำขอชนกันเสี้ยววินาทีอาจได้ 5 แทน 4 — ไม่ทำ unique index
  (โควตาแบบ "N ต่อเรื่อง" ทำด้วย index ไม่ได้) และขั้น 1 ของกติกาใหม่ทำให้ครั้งที่ 5
  ไม่มีน้ำหนักเพิ่มอยู่แล้ว
- ช่องทาง LINE ไม่เปลี่ยน (1 คน 1 คะแนน/เรื่อง ด้วย unique index เดิม)

### D. เทส (vitest — `lib/satisfaction/__tests__/`)

`fairStats.test.js`
- คนเดียวหลายเรื่อง (เบอร์เดียว) = 1 เสียง — เทียบกับค่าดิบต้องต่างกันตามคาด
- หลายคะแนนในเรื่องเดียวถูกเฉลี่ยก่อน (เช่น `[1,1,1,1]` + `[5]` คนละเรื่องคนละคน → 3.0)
- `reporterKey`: เบอร์มีช่องว่าง/ขีด → `tel:` เดียวกัน · เบอร์ว่าง → `line:` ·
  ไม่มี report → `complaint:` · ไม่เติม 0 ให้เบอร์ 9 หลัก
- `ratingDistribution` และ `bySource` ยังเป็นค่าดิบ (แถวไม่มี `source` → public)
- อินพุตว่าง → ศูนย์ทุกฟิลด์ · `method === "per-reporter"`
- เคสย่อส่วนจากข้อมูลจริง: 1 คน 7 เรื่อง 1 ดาว + คนอื่น 5 ดาว → ค่าใกล้ 5 ไม่ใช่ ~3

`isoWeek.test.js` — helper ต้องใช้ UTC getters หลังเลื่อน +7 ชม. จึง**ไม่ขึ้นกับ TZ ของเครื่อง**
(`vitest.config.mjs` ไม่ได้ตั้ง TZ; เทสต้องผ่านทั้งบนเครื่อง dev ที่เป็น Bangkok และ CI/เซิร์ฟเวอร์ที่เป็น UTC)
- ข้ามสัปดาห์เพราะ timezone: `2026-09-06T18:00Z` = อาทิตย์ 6 ก.ย. ใน UTC (W36) แต่เป็น
  จันทร์ 7 ก.ย. 01:00 Bangkok → ต้องได้ `2026-W37`
- ขอบปี: `2025-12-29T00:00Z` → `2026-W01` · `2027-01-03T00:00Z` → `2026-W53` (2026 มี 53 สัปดาห์ ISO)
- label เติม 0 หน้าสัปดาห์ < 10 (`2026-W05`)

`quota.test.js`
- `isPublicQuotaFull(3) === false`, `isPublicQuotaFull(4) === true`, `MAX === 4`

### E. เอกสาร

- `docs/modules/satisfaction.md`: เพิ่มหัวข้อ **"กติกาการนับ"** (3 ขั้น + `reporterKey`
  + ทำไม distribution ดิบ) · ตารางโควตาระบุ "บังคับฝั่ง server (`record.js`) แล้ว" ·
  ย้าย `stats.js`, `analytics/summary.ts`, `analytics/satisfaction.ts` ออกจากรายการ
  "อ่านกระจาย" ไปอยู่ใต้ `readStats.js` · หมายเหตุเฟส 2 (`duplicateOf`)
- `CLAUDE.md` bullet satisfaction: เติมประโยคเดียว — สถิติเฉลี่ยนับต่อผู้แจ้งผ่าน
  `lib/satisfaction/fairStats.js`; ห้ามคำนวณ `$avg` ดิบเองที่อื่น

### F. จุดต่อเฟส 2

เมื่อมี `duplicateOf` ในอนาคต ขั้น 1 จับกลุ่มด้วย "เรื่องแม่" แทน `complaintId` —
เปลี่ยนที่ `computeFairStats` จุดเดียว (รับ resolver `caseKey(complaintId)` เพิ่ม)

## การตรวจรับ

1. `npm test` ผ่านทั้งชุด (เทสใหม่ + เทสเดิมของโมดูล)
2. `npm run build` ผ่าน (ปิด `next dev` ก่อน)
3. บน dev เทียบ `GET /api/satisfaction/stats` กับ probe: `averageRating ≈ 4.85`,
   `reporters = 24`, `totalRatings = 59`, `rawAverage ≈ 4.41`
4. หน้า `/status/<เรื่องที่มี 4 คะแนนแล้ว>` → ฟอร์มซ่อน · ยิง `POST /api/satisfaction/create`
   ตรง ๆ ครั้งที่ 5 → 429 พร้อมข้อความไทย
5. `/admin/dashboard` และ `/admin/analytics` แสดงตัวเลขตรงกัน
