# แบบประเมินความพึงพอใจผ่าน LINE OA — ส่งตรงถึงเจ้าของเรื่อง

วันที่: 2026-08-17 · สถานะ: อนุมัติดีไซน์แล้ว รอทำแผน implementation

## 1. ปัญหาและเป้าหมาย

แบบประเมินความพึงพอใจของเรื่องร้องเรียนตอนนี้อยู่ที่เดียว คือการ์ดในหน้า `/status`
(`components/complaints/CardOfficail.js` → `components/SatisfactionForm.js`) ประชาชนต้องเข้าเว็บ
เปิดเรื่องของตัวเอง แล้วกดปุ่ม "ให้คะแนนความพึงพอใจ" เอง

ตัวเลขจริงจาก MongoDB (17 ส.ค. 2569):

| ตัวชี้วัด | ค่า |
|---|---|
| เรื่องที่ปิดงานแล้ว | 483 |
| เรื่องที่มีผลประเมินอย่างน้อย 1 รายการ | 41 (**8.5%**) |
| แถวใน `satisfactions` | 48 |
| เรื่องที่มีเบอร์โทร | 483/483 (100%) |
| เรื่องที่ผูก LINE แล้ว (ปิดใน 90 วันล่าสุด) | 42 จาก 84 (**50%** และกำลังโต — LINE เพิ่งเปิดใช้ ส.ค. 2569) |

**เป้าหมาย: เพิ่มจำนวนคนตอบ** โดยส่งแบบประเมินไปหาเจ้าของเรื่องถึงที่ ไม่ต้องรอให้เขาเข้าเว็บมาหาเอง

เป้าหมายรองที่ได้ติดมา: แยกได้ว่าคะแนนไหนมาจากคนที่ผูก LINE กับเรื่องนั้น (ใกล้ตัวจริง)
กับคะแนนที่ใครก็กดได้จากหน้าเว็บสาธารณะ

## 2. การตัดสินใจที่ล็อกแล้ว

| หัวข้อ | เลือก | เหตุผล |
|---|---|---|
| เป้าหมาย | เพิ่มคนตอบ | response rate 8.5% คือปัญหาหลัก |
| ช่องทาง | **LINE OA อย่างเดียว** | ฟรี ต่อยอดของที่มี ไม่ต้องจัดซื้อ SMS gateway · ครอบคลุม ~50% ของเรื่องที่ปิดล่าสุดและโตเอง |
| วิธีตอบ | **กดดาวในแชท (postback)** | 1 คลิกจบ ไม่ต้องเปิดเบราว์เซอร์ · ฟอร์มเว็บเก็บแค่ดาว+ความเห็น แชทเก็บได้ครบเท่ากัน |
| จังหวะส่ง | **แนบไปกับการ์ดปิดงานที่ push อยู่แล้ว** | ไม่เพิ่มจำนวน push (LINE OA free tier จำกัดจำนวนข้อความ) · ไม่ต้องมี cron ตามเตือน |
| การนับคะแนน | **เก็บรวมที่เดิม แต่ติด `source`** | กราฟ/สถิติเดิมไม่พัง แต่แยกดูได้ |
| กลไกปุ่ม | Flex postback (ไม่ใช่ quick reply) | quick reply หายทันทีที่ผู้ใช้พิมพ์อย่างอื่น และย้อนกลับมากดทีหลังไม่ได้ |

## 3. ข้อเท็จจริงจากโค้ดที่ดีไซน์นี้พึ่งพา

1. `models/Complaint.js` และ `models/SubmittedReport.js` ลงทะเบียน mongoose model ชื่อ `SubmittedReport`
   ชี้ collection `submittedreports` **เหมือนกันทั้งคู่** ⇒ `Satisfaction.complaintId` ที่เก็บอยู่ทุกวันนี้
   คือ `_id` ของ `submittedreports` อยู่แล้ว **ไม่ต้อง migrate**
   (หมายเหตุ: `Satisfaction.complaintId` ประกาศ `ref: "Complaint"` ซึ่งไม่มี model ชื่อนี้จริง —
   `populate()` จะพัง แต่โค้ดปัจจุบันไม่ได้ใช้ populate ที่ไหน จึงไม่แก้ในรอบนี้)
2. ข้อความอิสระที่ไม่ตรง pattern คำสั่งใดเลยใน `pages/api/integrations/line-webhook.ts`
   ตกไปที่ default "แนะนำวิธีใช้" ⇒ วางการดักความเห็น **ก่อน default นั้น** จะไม่ชนคำสั่งค้นหา
   เลขเรื่อง (`TKC-690001`, `69-001`), `เรื่องของฉัน`, rebind เบอร์ 4 ตัวท้าย, `help`
3. webhook ปัจจุบันรับเฉพาะ event `join` / `follow` / `message(text)` — **ยังไม่รับ `postback`**
4. `update-status.js` push การ์ดสถานะไปหา `existing.lineUserId` อยู่แล้วเมื่อสถานะเปลี่ยน
5. `formatStatusMessage()` ใน `lib/lineMessaging.ts` เรนเดอร์ body เป็น array อยู่แล้ว
   แทรก section เพิ่มได้โดยไม่ต้องรื้อ
6. คะแนนความพึงพอใจของเรื่องร้องเรียนแสดงที่ `/admin/dashboard` (เรียก `/api/satisfaction/stats`)
   และ `components/SatisfactionCommentsPanel.js` (เรียก `/api/satisfaction/recent-comments`)
   ส่วน `/admin/feedback-analysis` เป็นของ **ความเห็นนักเรียน** คนละโมดูล ไม่เกี่ยวกัน

## 4. Flow

```
[1] เจ้าหน้าที่ปิดงาน  (pages/api/submittedreports/update-status.js)
     └─ linePush การ์ดสถานะเดิมไปหา lineUserId
          + แนบแถบ "พอใจกับการแก้ไขแค่ไหน?" ⭐1 ⭐2 ⭐3 ⭐4 ⭐5  (action: postback)

[2] ผู้ใช้กดดาว
     └─ LINE ส่ง event postback → /api/integrations/line-webhook
          ├─ parse data → { complaintCode, score }
          ├─ upsert Satisfaction (source: 'line', lineUserId)
          └─ reply: "ขอบคุณครับ ⭐⭐⭐⭐ — อยากเล่าเพิ่มพิมพ์มาได้เลยตอนนี้ (ไม่สะดวกข้ามได้)"

[3] ผู้ใช้พิมพ์ข้อความอิสระภายใน 10 นาที
     └─ webhook: ไม่ตรง pattern คำสั่งใด ๆ → ก่อนตก default ให้เช็ค
          "มี Satisfaction ของ lineUserId นี้ source=line ที่ comment ว่าง และสร้างไม่เกิน 10 นาที?"
          ├─ มี  → บันทึกเป็น comment → reply ขอบคุณ
          └─ ไม่มี → default help เหมือนเดิม
```

**เก็บย้อนหลังฟรี:** `buildStatusMessages()` (คนพิมพ์เลขเรื่องมาถามสถานะ) ก็แนบแถบดาวด้วย
เมื่อครบเงื่อนไข ⇒ เรื่องเก่าที่ปิดไปแล้ว 483 เรื่องก็ยังเก็บคะแนนได้ โดยไม่ต้องยิง push ตามหลัง

**เงื่อนไขการแนบแถบดาว (ต้องครบทุกข้อ):**
- สถานะเรื่อง = `ดำเนินการเสร็จสิ้น`
- ไม่ใช่ `staffView` และไม่ใช่บริบทกลุ่ม
- มี `lineUserId` ปลายทาง
- `lineUserId` คนนี้ยังไม่เคยให้คะแนนเรื่องนี้ (ถ้าเคยแล้ว แสดงข้อความ "ให้คะแนนไว้แล้ว ⭐⭐⭐⭐" แทนแถบปุ่ม)

เงื่อนไขข้อสุดท้ายคุมแค่ "การ์ดใบใหม่" — **การ์ดใบเก่าที่ยังอยู่ในแชทกดได้ตลอด** และการกดนั้น
นับเป็นการอัปเดตคะแนน (ดูข้อ 5) ไม่ใช่ error

## 5. Data model

`models/Satisfaction.js` เพิ่ม 2 ฟิลด์:

```js
source:     { type: String, enum: ['public', 'line'], default: 'public', index: true },
lineUserId: { type: String, default: null },
```

- แถวเดิม 48 แถวได้ `source: 'public'` จาก default โดยอัตโนมัติ ไม่ต้องรัน migration
- index กันตอบซ้ำ — **partial** เพื่อไม่ให้กระทบแถวเดิมที่ `lineUserId` เป็น null:

```js
SatisfactionSchema.index(
  { complaintId: 1, lineUserId: 1 },
  { unique: true, partialFilterExpression: { lineUserId: { $type: 'string' } } }
);
```

  (`autoIndex` ไม่ได้ปิดใน `lib/dbConnect.js` → index สร้างเองตอน mongoose โหลด model
  collection เล็ก 48 แถว ไม่มีผลกับ production)

**กติกาคะแนน**
- LINE: 1 คะแนน/เรื่อง/lineUserId — กดซ้ำ = **อัปเดตคะแนนเดิม** ไม่เพิ่มแถว
- เว็บสาธารณะ: ยัง 4 ครั้ง/เรื่องเหมือนเดิม แต่ `count.js` นับเฉพาะ `source: 'public'`
  ⇒ คะแนนจากเจ้าของเรื่องไม่ไปกินโควตาของสาธารณะ
- ความเห็น (`comment`) เป็น **optional** ในเส้นทาง LINE (ฟอร์มเว็บยังบังคับกรอกเหมือนเดิม —
  การบังคับพิมพ์น่าจะเป็นสาเหตุหนึ่งที่ response rate ต่ำ แต่ไม่แก้ในรอบนี้เพื่อคุมขอบเขต)

## 6. สัญญาข้อความ (message contract)

**postback data** — รูปแบบ query string อ่านง่าย ตรวจสอบได้:

```
action=sat_rate&cid=TKC-690006&score=4
```

`parseRatingPostback()` ต้องคืน `null` เมื่อ: `action` ไม่ใช่ `sat_rate` · `score` ไม่ใช่จำนวนเต็ม 1-5 ·
`cid` ไม่ตรงรูปแบบ `TKC-<ตัวเลข>` — เพื่อไม่ให้ payload ปลอมสร้างแถวขยะ

**แถบดาวในการ์ด** — แทรกท้าย body ของ bubble เดิม (ไม่สร้าง message ใบใหม่):

```
──────────────
พอใจกับการแก้ไขแค่ไหน?
[⭐1] [⭐2] [⭐3] [⭐4] [⭐5]
```

**ข้อความตอบกลับ**
- กดครั้งแรก: `ขอบคุณครับ ⭐⭐⭐⭐\nอยากเล่าเพิ่มพิมพ์มาได้เลยตอนนี้ ถ้าไม่สะดวกข้ามได้ครับ`
- กดซ้ำ/เปลี่ยนคะแนน: `อัปเดตเป็น ⭐⭐⭐ แล้วครับ`
- บันทึกความเห็น: `รับความเห็นแล้ว ขอบคุณที่ช่วยให้เราทำงานดีขึ้นครับ`
- เรื่องไม่พบ: ข้อความขอโทษ + ไม่ throw

## 7. โครงไฟล์

**เพิ่มใหม่**

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/satisfaction/lineRating.js` | logic ล้วน ไม่มี I/O: `buildRatingPostbackData()`, `parseRatingPostback()`, `isWithinCommentWindow()`, `sanitizeComment()` (trim · ตัดที่ 500 ตัวอักษร · คืน `null` ถ้าว่าง), `RATING_COMMENT_WINDOW_MS = 10 * 60 * 1000` |
| `lib/satisfaction/record.js` | I/O ที่เดียว: `recordLineRating()`, `attachPendingComment()`, `hasLineRating()`, `recordPublicRating()` |
| `lib/satisfaction/__tests__/lineRating.test.js` | vitest |

**แก้**

| ไฟล์ | แก้อะไร |
|---|---|
| `models/Satisfaction.js` | 2 ฟิลด์ + partial unique index |
| `lib/lineMessaging.ts` | `formatStatusMessage()` รับ option แนบแถบดาว + helper ข้อความขอบคุณ |
| `pages/api/integrations/line-webhook.ts` | รับ event `postback` · ดักความเห็นก่อน default · แนบแถบดาวใน `buildStatusMessages()` |
| `pages/api/submittedreports/update-status.js` | แนบแถบดาวตอนปิดงาน |
| `pages/api/satisfaction/create.js` | เรียก `recordPublicRating()` แทน logic ในไฟล์ (ให้ n8n notify อยู่จุดเดียว) |
| `pages/api/satisfaction/count.js` | รองรับ `?source=public` |
| `pages/api/satisfaction/stats.js` | คืน `bySource: { public: {count, average}, line: {count, average} }` เพิ่ม (ฟิลด์เดิมคงไว้) |
| `components/complaints/CardOfficail.js` | เรียก count ด้วย `?source=public` |
| `pages/admin/dashboard.jsx` | แสดงว่าในคะแนนทั้งหมด มาจากเจ้าของเรื่องผ่าน LINE กี่รายการ เฉลี่ยเท่าไร |

## 8. เคสขอบ

| เคส | พฤติกรรม |
|---|---|
| กดดาวซ้ำ / เปลี่ยนใจ | upsert อัปเดตคะแนนเดิม (idempotent — LINE ยิง retry ก็ปลอดภัย) |
| กดจากกลุ่มเจ้าหน้าที่ | ไม่แนบปุ่มให้ `staffView` ตั้งแต่แรก + postback ที่มาจาก group/room = ignore |
| เรื่องยังไม่ปิดงาน | ไม่แนบปุ่ม |
| เรื่องถูกลบ / `cid` ไม่พบ | reply ข้อความขอโทษ ไม่ throw |
| ให้คะแนนไปแล้ว | การ์ดแสดง "ให้คะแนนไว้แล้ว ⭐⭐⭐⭐" แทนแถบปุ่ม |
| พิมพ์ความเห็นเกิน 10 นาที | ตกไป default help เหมือนเดิม (ข้อความตอนขอบคุณบอกให้พิมพ์ "ตอนนี้") |
| พิมพ์ความเห็นซ้ำรอบสอง | เก็บเฉพาะข้อความแรก (รอบสอง `comment` ไม่ว่างแล้ว → ตก default) |
| ความเห็นยาวมาก | ตัดที่ 500 ตัวอักษร |
| เรื่องลับ (`isConfidential`) | ให้คะแนนได้ปกติ — การ์ดฝั่งประชาชนไม่มีชื่อผู้แจ้งอยู่แล้ว (PR #126) |
| ไม่มี `LINE_CHANNEL_ACCESS_TOKEN` | ทุกอย่าง skip เงียบเหมือน flow LINE อื่นในระบบ |

## 9. ความเสี่ยงที่รับไว้

**`source: 'line'` ไม่เท่ากับ "ยืนยันตัวตนแล้ว"** — การผูก `lineUserId` กับเรื่องเป็นแบบ first-come
จากการพิมพ์เลขเรื่องที่ไล่เดาได้ คนที่ได้การ์ดจึงไม่การันตีว่าเป็นผู้ร้องตัวจริง
ตัวช่วยที่มีอยู่คือ rebind ด้วยเบอร์โทร 4 ตัวท้าย (`handleRebind`) ซึ่งย้ายการผูกมาที่เจ้าของเบอร์ได้
ดีไซน์นี้เลือกไม่บังคับยืนยันตัวตนก่อนให้คะแนน เพราะจะขัดกับเป้าหมาย "เพิ่มคนตอบ" โดยตรง
ให้เขียนกำกับความหมายนี้ไว้ทั้งใน schema comment และหน้า dashboard

**การดักความเห็นเป็น heuristic** — ข้อความอิสระใน 10 นาทีหลังกดดาวจะถูกตีความเป็นความเห็น
เนื่องจากวางไว้หลัง pattern คำสั่งทั้งหมด กรณีที่จะพลาดคือผู้ใช้พิมพ์ข้อความที่ "ตั้งใจถามอย่างอื่น
แต่ไม่ตรงคำสั่งใดเลย" ซึ่งเดิมได้ข้อความ help กลับไป — ผลเสียจำกัดแค่ความเห็นเพี้ยน 1 รายการ
และแอดมินลบได้

## 10. เทส

`lib/satisfaction/__tests__/lineRating.test.js` (vitest — ตามที่ repo ตั้งไว้ `lib/**/__tests__/*.test.js`)

- `buildRatingPostbackData()` ↔ `parseRatingPostback()` ไป-กลับตรงกัน
- `parseRatingPostback()` คืน `null` เมื่อ: action ผิด · score = 0, 6, `"4.5"`, ตัวอักษร · ไม่มี cid · cid ผิดรูปแบบ
- `isWithinCommentWindow()` — 9:59 นาที = true, 10:01 นาที = false, เวลาในอนาคต = false
- `sanitizeComment()` — trim, ข้อความว่าง/ช่องว่างล้วน → คืน `null`, ยาวเกิน 500 → ตัดที่ 500

ส่วน I/O (`record.js`) และการ์ดจริงทดสอบด้วยมือ — repo ยังไม่มี integration test infra
และเทสฝั่ง API/React ยังไม่มีทั้งโปรเจกต์

## 11. ลำดับงาน

PR เดียว แยก 4 commit ให้รีวิวง่าย:

1. `models/Satisfaction.js` + `lib/satisfaction/` (logic + record) + เทส
2. webhook รับ postback + ดักความเห็น
3. แนบแถบดาวในการ์ดปิดงาน (`update-status.js`) และการ์ดสถานะ (`buildStatusMessages`)
4. `count.js` / `stats.js` / `CardOfficail.js` / `dashboard.jsx`

ไม่มี env ใหม่ · ไม่มี migration script · ไม่ต้องตั้งค่าอะไรใน LINE Developers Console เพิ่ม
(postback มาที่ webhook URL เดิม)

**ทดสอบจริงหลัง deploy:** ปิดงานเรื่องทดสอบ → การ์ดต้องมีแถบดาว → กด → ตรวจแถวใน `satisfactions`
(`source: 'line'`, `lineUserId`, `rating`) → พิมพ์ความเห็นตาม → ตรวจว่า `comment` เข้า →
กดดาวซ้ำ → ตรวจว่าไม่มีแถวเพิ่ม แต่ `rating` เปลี่ยน

## 12. นอกขอบเขตรอบนี้

- SMS / ช่องทางอื่นนอกจาก LINE
- cron ตามเตือนคนที่ยังไม่ตอบ
- แก้ฟอร์มเว็บให้ความเห็นเป็น optional
- ยืนยันตัวตนก่อนให้คะแนน
- แก้ `ref: "Complaint"` ที่ชี้ model ที่ไม่มีอยู่จริง
- หน้าแอดมินสำหรับลบ/ซ่อนความเห็นที่ไม่เหมาะสม (ปัจจุบันไม่มีอยู่แล้ว)

เมื่อ implement เสร็จ ให้เพิ่ม/อัปเดตเอกสารโมดูลตาม convention ของ repo
(`docs/modules/` — ปัจจุบันยังไม่มีไฟล์ของโมดูล satisfaction)
