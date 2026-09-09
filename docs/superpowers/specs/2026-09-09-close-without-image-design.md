# ดีไซน์: ปิดเรื่องโดยไม่แนบภาพได้ (ติ๊กยืนยันแทน)

วันที่: 2026-09-09 · สถานะ: อนุมัติแล้ว · โมดูล: tasks (`docs/modules/tasks.md`) · branch: `close-without-image`

## ปัญหา

การปิดเรื่อง (`CloseTaskModal` → `PATCH /api/tasks/[assignmentId]` `action:'close'`) บังคับแนบภาพผลงาน
อย่างน้อย 1 ภาพเสมอ (`lib/tasks/timeline.js#closeChecklist`) — แต่บางเรื่องเป็นเพียงการสอบถามข้อมูล
ไม่มีงานภาคสนามให้ถ่ายภาพ เจ้าหน้าที่ปิดเรื่องไม่ได้ตามจริง

## แนวทางที่เลือก (user เลือกจาก 3 ทาง 2026-09-09)

**ไม่บังคับรูป + ติ๊กยืนยันเมื่อไม่มีรูป** — รูปเป็น optional ทุกเรื่อง แต่ถ้าปิดโดยไม่มีรูป
ต้องติ๊กช่องยืนยัน กันเผลอลืมแนบรูปในงานภาคสนามจริง
(ทางที่ไม่เลือก: เอาเงื่อนไขออกเฉย ๆ — เสี่ยงลืมแนบ · บังคับตามประเภทเรื่องผ่าน TaskSettings — เกินจำเป็นตอนนี้)

## การเปลี่ยนแปลง

### 1. กติกา — `lib/tasks/timeline.js#closeChecklist` (logic ล้วน จุดเดียว ทั้ง UI และ server เรียกร่วมกัน)

ลายเซ็นใหม่: `closeChecklist({ note, images, confirmNoImages })`

| อินพุต | ผล |
|---|---|
| มีรูป ≥1 + มี note | ok (เหมือนเดิม — `confirmNoImages` ไม่มีผล) |
| ไม่มีรูป + `confirmNoImages: true` + มี note | **ok (ใหม่)** |
| ไม่มีรูป + ไม่ติ๊ก | error `"ยังไม่ได้แนบภาพผลงาน — ติ๊กยืนยันหากเรื่องนี้ไม่จำเป็นต้องมีภาพ (เช่น เป็นการสอบถามข้อมูล)"` |
| note ว่าง | error `"ต้องเขียนบันทึกสรุปการดำเนินงาน"` (เดิม ไม่เปลี่ยน) |

คอมเมนต์หัวฟังก์ชัน (เดิมอ้าง "README หน้าจอ 3") อัปเดตตามกติกาใหม่

### 2. Server — `pages/api/tasks/[assignmentId].ts` (action `close`)

อ่าน `confirmNoImages = body.confirmNoImages === true` แล้วส่งเข้า `closeChecklist` —
ยิง API ตรงโดยไม่มีรูปก็ต้องส่ง flag (ไม่ผ่านแล้วได้ 400 พร้อมข้อความจาก checklist เหมือนพฤติกรรมเดิม)
ที่เหลือของ path ปิดเรื่อง (solutionImages รวมรูป, timeline `kind:'closed'`, แจ้ง LINE, audit) ไม่เปลี่ยน —
เรื่องที่ปิดไม่มีรูปจะได้ `solutionImages` ว่างและ timeline entry ไม่มี `images` ตามจริง

### 3. UI — `components/tasks/CloseTaskModal.tsx`

- state ใหม่ `confirmNoImages` (default `false`) · แสดง checkbox **เฉพาะเมื่อ `images.length === 0`**:
  ป้าย "ปิดเรื่องโดยไม่แนบภาพผลงาน (เช่น เป็นการสอบถามข้อมูล / ไม่มีงานภาคสนาม)"
- การกดปุ่มปิดเรื่องผ่านได้ตาม `closeChecklist({ note, images, confirmNoImages })` เหมือนกลไกเดิม (กดแล้วไม่ผ่าน = โชว์รายการ error — ปุ่มไม่ได้ disabled ตาม checklist อยู่แล้ว)
  (ข้อความ error โชว์จาก checklist ตามที่ modal ทำอยู่แล้ว)
- เมื่อมีรูป: checkbox ไม่แสดง และค่า `confirmNoImages` ที่เคยติ๊กไว้ไม่ถูกส่ง (ส่งเฉพาะกรณีไม่มีรูป)
- `onSubmit` ส่ง `confirmNoImages` ต่อไปยัง `PATCH` body (type ใน `pages/admin/my-tasks/[assignmentId].tsx` ปรับตาม)

### 4. ฝั่งประชาชน — ตรวจว่ารองรับรูปว่าง (คาดว่าไม่ต้องแก้ แต่ต้องยืนยันตอน implement)

- หน้า `/status/[id]` (BeforeAfter / รูปผลงาน) และการ์ดปิดงาน LINE (`lib/lineMessaging.ts`) ต้องไม่พังเมื่อ
  `solutionImages` ว่าง — ถ้าพบจุดที่พัง แก้เป็นซ่อนส่วนรูปไป (แสดงเฉพาะข้อความสรุป)

### 5. เทส — `lib/tasks/__tests__/timeline.test.js`

ปรับ describe ของ `closeChecklist`: 4 เคสตามตารางข้อ 1 (เคสเดิม "ขาดทั้งคู่ → 2 ข้อความ" ยังคงไว้
โดยความหมายใหม่คือ ไม่มีรูป+ไม่ติ๊ก+note ว่าง → 2 ข้อความ)

### 6. เอกสาร — `docs/modules/tasks.md`

จุดที่เขียน "≥1 ภาพ + สรุป" (บรรทัดแถว ~23 และ ~126) → "สรุปบังคับ · ภาพ optional —
ปิดโดยไม่มีภาพต้องติ๊กยืนยัน (`confirmNoImages`)"

## นอกสโคป

- ไม่แตะกติกา stepper/stage อื่น · ไม่เพิ่มการตั้งค่าใน TaskSettings · ไม่บันทึกเหตุผลเพิ่มว่าทำไมไม่มีรูป
  (ข้อความสรุปมีอยู่แล้ว)

## การตรวจรับ

1. `npm test` ผ่าน (เทส closeChecklist ชุดใหม่)
2. `npx tsc --noEmit` + lint ผ่าน
3. dev: ปิดเรื่องแบบมีรูป = พฤติกรรมเดิม · แบบไม่มีรูป: ไม่ติ๊ก → กดแล้วเห็นข้อความเตือน, ติ๊ก → ปิดได้
4. ยิง `PATCH action:'close'` ตรงโดยไม่มีรูปและไม่ส่ง flag → 400 ข้อความใหม่
5. เรื่องที่ปิดไม่มีรูป: `/status/<id>` และการ์ด LINE แสดงข้อความสรุปโดยไม่มีส่วนรูป ไม่มี UI พัง
