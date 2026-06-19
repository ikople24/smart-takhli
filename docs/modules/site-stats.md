# สถิติการเข้าชมเว็บไซต์ (site-stats)

นับและแสดงสถิติการเข้าชมเว็บไซต์สาธารณะบนหน้าหลัก (ยอดรวม/วันนี้/เดือนนี้/ออนไลน์)

## หน้า
- แสดงผล: การ์ด `SiteStatsBar` บน `pages/index.tsx` (ส่วนล่าง ใต้ "คู่มือประชาชน" เหนือ Footer)

## API (public, แตะ Mongo เท่านั้น — ไม่ใช้ Clerk)
- `POST /api/site-stats/visit` — นับการเข้าชม (กันซ้ำ 1/วัน/แท็บ ฝั่ง client ด้วย sessionStorage)
- `POST /api/site-stats/ping` — heartbeat ออนไลน์ (body `{clientId}`; ไม่มี clientId → 400)
- `GET  /api/site-stats` — คืน `{ success, data:{ total, today, month, online } }`

## Models (`models/site-stats/`)
- `SiteVisitDaily` (`site_visit_daily`) — `{date:"YYYY-MM-DD", count}` (เขต Asia/Bangkok)
- `SiteStatsTotal` (`site_stats_total`) — doc เดียว `_id:"total"` running total
- `SiteOnline` (`site_online`) — `{clientId, lastSeen}` + **TTL index 300 วิ** (ลบ doc ที่เงียบเอง)

## การนับ
- visit: นับทั้งเว็บผ่าน hook `useSiteTracking` ใน `_app.tsx` — ยกเว้น `/admin/*`, `/user/*` (เจ้าหน้าที่)
- online: ping ทุก 60 วิ; TTL ลบ doc ที่เงียบเกิน 5 นาที → `countDocuments()` = ออนไลน์ตอนนี้
- "เดือนนี้" = aggregate `$sum` ของ daily docs ที่ `date` ขึ้นต้นด้วย `YYYY-MM` ปัจจุบัน

## Components (`components/site-stats/`)
- `useSiteTracking` — hook เรียกใน `_app` (visit + heartbeat)
- `useCountUp` — เลขนับขึ้นด้วย requestAnimationFrame (ease-out, re-animate เมื่อ target เปลี่ยน)
- `SiteStatsBar` — การ์ด 4 ช่อง, เริ่มนับเมื่อ scroll เข้า viewport (IntersectionObserver), poll online ทุก 60 วิ

## lib
- `lib/site-stats/date.js#getBangkokYMD` — วันที่เขต Asia/Bangkok
  (ซ้ำกับของ pm25/smart-papar — รวมเป็น util กลางเฟส 6/7)

## หมายเหตุ
- `clientId` เป็น UUID สุ่มใน localStorage — ไม่มี PII (PDPA-safe)
- ไม่มีหน้า analytics admin / ไม่นับ unique-visitor/referrer/geo (YAGNI)
