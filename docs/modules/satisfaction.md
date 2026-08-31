# ประเมินความพึงพอใจ (satisfaction)

แบบประเมินความพึงพอใจการใช้บริการ — ลิงก์จากระบบร้องเรียนหลังปิดเรื่อง

## หน้า

- `/user/satisfaction` (hideFromMenu — เข้าผ่าน internal link)
- สถิติคะแนนแสดงที่ `/admin/dashboard` (การ์ด "ความพึงพอใจ" + แผง `SatisfactionCommentsPanel`) — ไม่มีหน้า analysis แยกของโมดูลนี้
- `/admin/feedback-analysis` **ไม่ใช่**ของโมดูลนี้ — เป็นของความเห็นนักเรียน (`StudentFeedback`, ดูโมดูล Smart School) และยังพัง (⚠️ hideFromMenu ไว้ใน `lib/permissions.ts`)

## API / Model

- `pages/api/satisfaction/*` (รวม `[id].js`) — `count.js` รับ/คืนค่าแยกตาม `source` · `stats.js` คืนสถิติรวม (ดู "กติกาการนับ")
- `models/Satisfaction.js` — `source: 'public' | 'line'`, `lineUserId`
- `lib/satisfaction/lineRating.js` — logic ล้วนของ postback (มีเทส)
- `lib/satisfaction/quota.js` — ค่าคงที่โควตา 4 ครั้ง/เรื่อง + `isPublicQuotaFull` (มีเทส) — ใช้ทั้ง server และ client
- `lib/satisfaction/fairStats.js` — กติกานับ "1 ผู้แจ้ง = 1 เสียง" (logic ล้วน มีเทส) · `lib/satisfaction/isoWeek.js` — แบ่งถังรายสัปดาห์ Bangkok (มีเทส)
- `lib/satisfaction/readStats.js` — **จุดเดียว**ที่อ่านข้อมูลทำสถิติรวม → ผู้เรียก `pages/api/satisfaction/stats.js`,
  `pages/api/analytics/summary.ts`, `pages/api/analytics/satisfaction.ts` — **ห้ามคำนวณ `$avg` ดิบเองที่อื่น**
- `lib/satisfaction/record.js` — **จุดเดียว**ที่เขียน collection `satisfactions` (รวมด่านโควตาฝั่ง server)
  ⚠️ การอ่าน**รายเรื่อง**ยังอ่านตรงจาก model ที่ `pages/api/satisfaction/{count,[id],by-complaint,recent-comments}.js`, `pages/api/tasks/pending.ts`
  เอนด์พอยต์ที่หน้าสาธารณะเรียกต้อง `.select()` เฉพาะฟิลด์ที่ใช้เสมอ — คืนทั้ง document = ปล่อย `lineUserId` ของประชาชนออกเว็บ
  (`by-complaint.js` ไม่มี caller ในโค้ดแล้ว แต่ยัง deploy อยู่)

## ช่องทางให้คะแนน

| ช่องทาง | ใครให้ได้ | โควตา | `source` |
|---|---|---|---|
| การ์ดหน้า `/status` | ใครก็ได้ที่เปิดเรื่องนั้น | 4 ครั้ง/เรื่อง — บังคับฝั่ง server ใน `record.js` (2026-08-31) → API ตอบ 429 · ค่าคงที่ `lib/satisfaction/quota.js` | `public` |
| ปุ่มดาวในการ์ด LINE | คนที่ผูก LINE กับเรื่องนั้น | 1 ครั้ง/เรื่อง (แก้ได้) | `line` |

การ์ด LINE แนบแถบ ⭐1-5 (postback) ไปกับการ์ดปิดงานและการ์ดสถานะของเรื่องที่ปิดแล้ว
กดดาว → บันทึกทันที → ข้อความอิสระที่พิมพ์ตามภายใน **10 นาที** ถูกเก็บเป็น `comment`
(logic วางไว้หลัง pattern คำสั่งทั้งหมดใน `line-webhook.ts` จึงไม่ชนคำสั่งค้นหา)

⚠️ `source: 'line'` แปลว่า "คนที่ผูก LINE กับเรื่องนี้" **ไม่ใช่ "ยืนยันตัวตนแล้ว"** —
การผูกเป็นแบบ first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้ (ทางออกคือยืนยันเบอร์ 4 ตัวท้ายเพื่อย้ายการผูก)
เรื่องที่ผูกกับ LINE คนอื่นอยู่แล้วจะไม่ได้ปุ่มดาว

## กติกาการนับ (2026-08-31 — spec `docs/superpowers/specs/2026-08-31-satisfaction-fair-stats-design.md`)

ค่าเฉลี่ยที่เป็น headline (การ์ดแดชบอร์ด %, การ์ด "x / 5" และกราฟรายสัปดาห์บน `/admin/analytics`)
นับแบบ **"1 ผู้แจ้ง = 1 เสียง"** ใน `lib/satisfaction/fairStats.js#computeFairStats`:

1. เฉลี่ยคะแนน**ภายในเรื่อง**เดียวกัน → 1 เรื่อง = 1 ค่า (กดซ้ำ/ปั่นโควตาไม่มีน้ำหนักเพิ่ม)
2. เฉลี่ยค่าของทุกเรื่องที่ `reporterKey` เดียวกัน → 1 ผู้แจ้ง = 1 ค่า
3. เฉลี่ยข้ามผู้แจ้ง → `averageRating`

`reporterKey` = `tel:<เบอร์ตัดอักขระที่ไม่ใช่ตัวเลข>` → ไม่มีเบอร์ `line:<lineUserId>` → ไม่มีทั้งคู่/เรื่องถูกลบ `complaint:<id>`
(ไม่เติม 0 ให้เบอร์ 9 หลัก) · กติกาเดียวใช้กับทุกคน — เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชนหลายเรื่องก็ยุบเป็น 1 เสียง
· ⚠️ `reporters` คือจำนวน**ผู้แจ้ง** (เจ้าของเรื่องที่มีคะแนน) **ไม่ใช่**จำนวนคนที่กดดาว — UI ต้องใช้คำว่า "ผู้แจ้ง N ราย"

**ทำไม:** ผู้แจ้งรายเดียวยื่นเรื่องเดิมซ้ำ ~10 ใบแล้วให้ 1 ดาวทุกใบ ทำให้ % รวมตกจาก 97% เหลือ 88%
ทั้งที่ประชาชนที่เหลือพอใจ — ไม่บล็อก/ไม่ลบ/ไม่ซ่อนคะแนนใคร แค่ให้ทุกคนมีน้ำหนักเท่ากัน

**ตัวเลขดิบยังคืนเพื่อความโปร่งใส:** `totalRatings` (ครั้ง), `rawAverage`, `ratingDistribution` (histogram รายดาว **ดิบ** —
แถบ 1 ดาวยังเห็นจำนวนจริง), `bySource` (ดิบ) · ฟิลด์ใหม่ `reporters`, `ratedComplaints`, `method: "per-reporter"`
· กราฟรายสัปดาห์แบ่งถัง ISO week เวลา Bangkok ใน JS (`isoWeek.js`) แล้วใช้กติกาเดียวกันต่อถัง
(ของเดิมผสม `$year` ปฏิทินกับ `$isoWeek` ทำให้ label ช่วงปีใหม่เพี้ยน — แก้ไปด้วย)

**เฟส 2 (ยังไม่ทำ):** ผูกเรื่องซ้ำ `duplicateOf` — เปลี่ยนคีย์ขั้น 1 จาก `complaintId` เป็นเรื่องแม่ที่ `computeFairStats` จุดเดียว

## Components (⚠️ ยังอยู่ root — รอเฟส 5)

`SatisfactionForm.js`, `SatisfactionChart.js`, `SatisfactionCommentsPanel.js`

## หมายเหตุ

โมดูลนี้อาจถูกใช้เป็นแหล่งคะแนนของ**ฟีดกิจกรรม** (roadmap เฟส 2) —
ตัดสินใจตอน brainstorm ว่าจะใช้ `Satisfaction` หรือ `StudentFeedback` ต่อกิจกรรม
