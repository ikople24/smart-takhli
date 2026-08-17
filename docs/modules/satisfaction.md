# ประเมินความพึงพอใจ (satisfaction)

แบบประเมินความพึงพอใจการใช้บริการ — ลิงก์จากระบบร้องเรียนหลังปิดเรื่อง

## หน้า

- `/user/satisfaction` (hideFromMenu — เข้าผ่าน internal link)
- สถิติคะแนนแสดงที่ `/admin/dashboard` (การ์ด "ความพึงพอใจ" + แผง `SatisfactionCommentsPanel`) — ไม่มีหน้า analysis แยกของโมดูลนี้
- `/admin/feedback-analysis` **ไม่ใช่**ของโมดูลนี้ — เป็นของความเห็นนักเรียน (`StudentFeedback`, ดูโมดูล Smart School) และยังพัง (⚠️ hideFromMenu ไว้ใน `lib/permissions.ts`)

## API / Model

- `pages/api/satisfaction/*` (รวม `[id].js`) — `count.js` และ `stats.js` รับ/คืนค่าแยกตาม `source`
- `models/Satisfaction.js` — `source: 'public' | 'line'`, `lineUserId`
- `lib/satisfaction/lineRating.js` — logic ล้วนของ postback (มีเทส)
- `lib/satisfaction/record.js` — **จุดเดียว**ที่เขียน/อ่าน collection `satisfactions`

## ช่องทางให้คะแนน

| ช่องทาง | ใครให้ได้ | โควตา | `source` |
|---|---|---|---|
| การ์ดหน้า `/status` | ใครก็ได้ที่เปิดเรื่องนั้น | 4 ครั้ง/เรื่อง | `public` |
| ปุ่มดาวในการ์ด LINE | คนที่ผูก LINE กับเรื่องนั้น | 1 ครั้ง/เรื่อง (แก้ได้) | `line` |

การ์ด LINE แนบแถบ ⭐1-5 (postback) ไปกับการ์ดปิดงานและการ์ดสถานะของเรื่องที่ปิดแล้ว
กดดาว → บันทึกทันที → ข้อความอิสระที่พิมพ์ตามภายใน **10 นาที** ถูกเก็บเป็น `comment`
(logic วางไว้หลัง pattern คำสั่งทั้งหมดใน `line-webhook.ts` จึงไม่ชนคำสั่งค้นหา)

⚠️ `source: 'line'` แปลว่า "คนที่ผูก LINE กับเรื่องนี้" **ไม่ใช่ "ยืนยันตัวตนแล้ว"** —
การผูกเป็นแบบ first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้ (ทางออกคือยืนยันเบอร์ 4 ตัวท้ายเพื่อย้ายการผูก)
เรื่องที่ผูกกับ LINE คนอื่นอยู่แล้วจะไม่ได้ปุ่มดาว

## Components (⚠️ ยังอยู่ root — รอเฟส 5)

`SatisfactionForm.js`, `SatisfactionChart.js`, `SatisfactionCommentsPanel.js`

## หมายเหตุ

โมดูลนี้อาจถูกใช้เป็นแหล่งคะแนนของ**ฟีดกิจกรรม** (roadmap เฟส 2) —
ตัดสินใจตอน brainstorm ว่าจะใช้ `Satisfaction` หรือ `StudentFeedback` ต่อกิจกรรม
