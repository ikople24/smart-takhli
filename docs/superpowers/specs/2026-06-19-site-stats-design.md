# สถิติการเข้าชมเว็บไซต์ (site-stats) — Design

**วันที่:** 2026-06-19
**ประเภท:** ฟีเจอร์ใหม่ (โมดูล `site-stats`)

## เป้าหมาย

แสดงการ์ดสถิติการเข้าชมเว็บไซต์บนหน้าหลัก (ส่วนล่าง ถัดจาก "คู่มือประชาชน" ก่อน Footer)
UI สมัยใหม่ มีลูกเล่นตัวเลขนับขึ้นแบบ transition โชว์ 4 ค่า: **ยอดรวมทั้งหมด · วันนี้ ·
เดือนนี้ · กำลังออนไลน์**

## การตัดสินใจที่ยืนยันแล้ว

1. **แหล่งข้อมูล:** สร้างตัวนับเองใน MongoDB (ไม่พึ่ง Google Analytics)
2. **Metrics:** total (all-time), today, month, online-now — ครบทั้ง 4
3. **กฎการนับ visit:** 1 ครั้ง/session/วัน (กันซ้ำด้วย `sessionStorage`)
4. **ขอบเขต:** นับทั้งเว็บผ่าน hook ใน `_app.tsx` — **ยกเว้น** route `/admin/*` และ `/user/*`
   (เจ้าหน้าที่ ไม่ใช่ผู้เข้าชมสาธารณะ)
5. **PDPA:** `clientId` เป็น UUID สุ่มเก็บใน `localStorage` — ไม่มี PII ไม่ผูกตัวตน

## สถาปัตยกรรม (โมดูล `site-stats` ตาม convention repo)

### Models — `models/site-stats/`

- **`SiteVisitDaily.js`** — collection `site_visit_daily`
  - `{ date: String (YYYY-MM-DD เขต Asia/Bangkok, unique index), count: Number }`
  - ใช้คำนวณ "วันนี้" (doc วันนี้) และ "เดือนนี้" (sum docs ที่ `date` ขึ้นต้น `YYYY-MM`)
- **`SiteStatsTotal.js`** — collection `site_stats_total`
  - doc เดียว `{ _id: "total", count: Number }` — running total (กันต้อง scan ทุก day doc)
- **`SiteOnline.js`** — collection `site_online`
  - `{ clientId: String (unique), lastSeen: Date }`
  - **TTL index** บน `lastSeen` `expireAfterSeconds: 300` (5 นาที) — doc หมดอายุเองเมื่อไม่ ping

### API — `pages/api/site-stats/` (public, แตะ Mongo เท่านั้น ไม่ใช้ Clerk)

- **`POST /api/site-stats/visit`**
  - คำนวณวันที่วันนี้ (Asia/Bangkok) → `SiteVisitDaily.updateOne({date}, {$inc:{count:1}}, {upsert:true})`
    และ `SiteStatsTotal.updateOne({_id:"total"}, {$inc:{count:1}}, {upsert:true})`
  - คืน `{ success: true }`
  - การกันซ้ำ 1/วัน อยู่ฝั่ง client (sessionStorage key `site-visit-YYYY-MM-DD`)
- **`POST /api/site-stats/ping`** — body `{ clientId }`
  - `SiteOnline.updateOne({clientId}, {$set:{lastSeen:new Date()}}, {upsert:true})`
  - คืน `{ success: true }`; ถ้าไม่มี `clientId` → 400
- **`GET /api/site-stats`**
  - `total` = `SiteStatsTotal` doc (0 ถ้าไม่มี)
  - `today` = `SiteVisitDaily` doc ของวันนี้ (0 ถ้าไม่มี)
  - `month` = aggregate `$sum` ของ daily docs ที่ `date` ขึ้นต้นด้วย `YYYY-MM` ปัจจุบัน
  - `online` = `SiteOnline.countDocuments()` (TTL จัดการ stale ให้แล้ว)
  - คืน `{ success:true, data:{ total, today, month, online } }`

### lib — `lib/site-stats/date.js`

- helper เดียว `getBangkokYMD(date = new Date())` → `"YYYY-MM-DD"` (เขต Asia/Bangkok ด้วย
  `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'})`) — month prefix หาได้จาก
  `getBangkokYMD().slice(0,7)` ไม่ต้องมีฟังก์ชันแยก ใช้ร่วมใน API ทั้ง 3
- หมายเหตุ: ฟังก์ชันนี้ซ้ำกับ `getBangkokYMD` ที่มีอยู่ใน `lib/pm25Sync.js` +
  `lib/smartPaparWaterQualitySheet.js` (ของเดิมก็ซ้ำกันอยู่) — เก็บ self-contained ในโมดูล
  ก่อน, การรวมเป็น util กลางเป็นงานเก็บกวาดเฟส 6/7 ไม่ทำในเฟสนี้

### Tracking hook — `components/site-stats/useSiteTracking.ts`

- เรียกครั้งเดียวใน `_app.tsx`
- เมื่อ route **ไม่** ขึ้นต้น `/admin` หรือ `/user`:
  - **visit**: ถ้า `sessionStorage` ยังไม่มี key ของวันนี้ → POST `/api/site-stats/visit` แล้ว set key
  - **ping**: อ่าน/สร้าง `clientId` ใน `localStorage` → POST `/api/site-stats/ping` ทันที
    แล้วตั้ง `setInterval` ทุก 60 วินาที (เคลียร์ตอน unmount)
- ทุก fetch เป็น fire-and-forget (`.catch(()=>{})`) — ห้ามกระทบการโหลดหน้า

### UI components — `components/site-stats/`

- **`useCountUp.ts`** — hook นับเลขขึ้นจาก 0 → target ด้วย `requestAnimationFrame`
  (รับ `target`, `duration` ~1200ms, `start` boolean) — ไม่เพิ่ม dependency ภายนอก
- **`SiteStatsBar.tsx`**
  - mount → `GET /api/site-stats` (1 ครั้ง) + poll `online` ซ้ำทุก ~60 วิ (อาจเรียก GET ซ้ำ)
  - การ์ด 4 ช่อง (responsive: 2 คอลัมน์มือถือ / 4 เดสก์ท็อป) — ไอคอนต่อ metric
  - ตัวเลขใช้ `useCountUp` เริ่มนับเมื่อ scroll เข้า viewport (IntersectionObserver)
  - "กำลังออนไลน์" มีจุดเขียวกะพริบ (`animate-ping`/pulse)
  - รายละเอียดสไตล์ (gradient/glass, สี, spacing) → ให้ frontend-design จัดตอน implement

### การวางบนหน้าหลัก — `pages/index.tsx`

แทรก `<SiteStatsBar />` ระหว่าง `<div>` แถบคู่มือประชาชน (จบบรรทัด ~217) กับ `<Footer />`

## Data flow

```
ผู้เข้าชมเปิดหน้า public
  → _app useSiteTracking: POST /visit (1/วัน) + POST /ping (ทุก 60s)
หน้าหลัก:
  → SiteStatsBar: GET /api/site-stats → count-up animation
  → poll online ทุก 60s
MongoDB: site_visit_daily, site_stats_total (สะสม), site_online (TTL 5 นาที)
```

## Error handling

- ทุก endpoint คืน 500 `{success:false}` เมื่อ error และ log; client เป็น fire-and-forget
- ถ้า `GET /api/site-stats` ล้มเหลว → SiteStatsBar ไม่แสดง (return null) ไม่ทำหน้าพัง
- TTL index จัดการ online เอง ไม่ต้องมี cron

## การทดสอบ

โปรเจกต์ไม่มี test runner (CLAUDE.md) — ตรวจด้วย:
- `npm run build` + `npm run lint`
- `curl -X POST /api/site-stats/visit` แล้ว `GET /api/site-stats` → `total`/`today`/`month` +1
- `curl -X POST /api/site-stats/ping -d '{"clientId":"x"}'` → `online` = 1
- เปิดหน้าหลัก dev → เห็นการ์ด 4 ช่อง ตัวเลขนับขึ้น, refresh ไม่เพิ่ม visit ซ้ำ (session เดิม)

## นอกขอบเขต (YAGNI)

- ไม่ทำกราฟ/หน้า analytics admin (เฟสนี้แสดงการ์ดบนหน้าหลักเท่านั้น)
- ไม่นับ unique visitor แยกราย, ไม่เก็บ referrer/หน้าที่เข้า, ไม่มี geo
