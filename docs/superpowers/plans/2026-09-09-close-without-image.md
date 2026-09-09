# Close Without Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดเรื่องได้โดยไม่ต้องแนบภาพผลงาน — ถ้าไม่มีภาพต้องติ๊กยืนยัน (เช่น เรื่องสอบถามข้อมูล) · spec `docs/superpowers/specs/2026-09-09-close-without-image-design.md`

**Architecture:** กติกาอยู่ที่ฟังก์ชันล้วน `closeChecklist` จุดเดียว ซึ่งทั้ง `CloseTaskModal` (client) และ `PATCH /api/tasks/[assignmentId]` (server) เรียกร่วมกัน — เพิ่มพารามิเตอร์ `confirmNoImages` ที่กติกา แล้วต่อท่อจาก checkbox ใน modal ผ่าน payload ไปถึง server · ฝั่งประชาชน (/status, LINE) รองรับ `solutionImages` ว่างอยู่แล้ว (ยืนยันใน Task 4)

**Tech Stack:** Next.js 15 Pages Router + TS strict, vitest (`npx vitest run <path>`), Tailwind+DaisyUI (โทเคน `tk-*`)

**Branch:** `close-without-image` (แตกจาก origin/main ที่ 602dad1 — มี spec commit แล้ว) · ก่อน commit ทุกครั้งรัน `git branch --show-current` ต้องได้ `close-without-image`

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| Modify `lib/tasks/timeline.js:129-135` | กติกา `closeChecklist` — จุดเดียวของเงื่อนไขปิดเรื่อง |
| Modify `lib/tasks/__tests__/timeline.test.js:107-116` | เทสกติกาใหม่ 4 เคส |
| Modify `pages/api/tasks/[assignmentId].ts:245-249` | อ่าน `confirmNoImages` จาก body ส่งเข้า checklist |
| Modify `components/tasks/CloseTaskModal.tsx` | checkbox ยืนยัน + label ภาพเป็น optional + ส่งค่าใน payload |
| Modify `docs/modules/tasks.md:23,126` | อัปเดตกติกาในเอกสาร |

(ผู้เรียก modal ที่ `pages/admin/my-tasks/[assignmentId].tsx:181` ใช้ `...payload` spread — ได้ `confirmNoImages` อัตโนมัติเมื่อ `ClosePayload` เปลี่ยน type ไม่ต้องแก้ไฟล์นั้น)

---

### Task 1: กติกา `closeChecklist` + เทส (TDD)

**Files:**
- Modify: `lib/tasks/timeline.js:129-135`
- Test: `lib/tasks/__tests__/timeline.test.js:107-116`

- [ ] **Step 1: แทนเทสเดิมด้วยชุดใหม่ (fail ก่อน)**

ใน `lib/tasks/__tests__/timeline.test.js` แทนทั้ง describe เดิม
```js
describe("closeChecklist — ปิดเรื่องต้องมี ≥1 ภาพผลงาน + บันทึกสรุป", () => {
  it("ขาดทั้งคู่ → 2 ข้อความ; ครบ → ok", () => {
    const bad = closeChecklist({ note: "  ", images: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors.join(" ")).toMatch(/ภาพ/);

    expect(closeChecklist({ note: "เปลี่ยนโคมไฟแล้ว", images: ["a.jpg"] })).toEqual({ ok: true, errors: [] });
  });
});
```
ด้วย
```js
describe("closeChecklist — สรุปบังคับเสมอ · ภาพ ≥1 หรือติ๊กยืนยันปิดโดยไม่มีภาพ", () => {
  it("ไม่มีภาพ+ไม่ติ๊ก+สรุปว่าง → 2 ข้อความ", () => {
    const bad = closeChecklist({ note: "  ", images: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors.join(" ")).toMatch(/ภาพ/);
  });

  it("มีภาพ + สรุป → ok โดยไม่ต้องติ๊ก (พฤติกรรมเดิม)", () => {
    expect(closeChecklist({ note: "เปลี่ยนโคมไฟแล้ว", images: ["a.jpg"] })).toEqual({ ok: true, errors: [] });
  });

  it("ไม่มีภาพ + ติ๊กยืนยัน + สรุป → ok (เช่น เรื่องสอบถามข้อมูล)", () => {
    expect(closeChecklist({ note: "ตอบข้อสอบถามแล้ว", images: [], confirmNoImages: true })).toEqual({ ok: true, errors: [] });
  });

  it("ไม่มีภาพ+ไม่ติ๊ก+มีสรุป → error ภาพอย่างเดียว · ติ๊กแต่สรุปว่าง → error สรุปอย่างเดียว", () => {
    const noImg = closeChecklist({ note: "ทำแล้ว", images: [] });
    expect(noImg.ok).toBe(false);
    expect(noImg.errors).toHaveLength(1);
    expect(noImg.errors[0]).toMatch(/ติ๊กยืนยัน/);

    const noNote = closeChecklist({ note: "", images: [], confirmNoImages: true });
    expect(noNote.errors).toEqual(["ต้องเขียนบันทึกสรุปการดำเนินงาน"]);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run lib/tasks/__tests__/timeline.test.js`
Expected: FAIL 2 เคสใหม่ (เคส confirmNoImages → errors ไม่ว่าง / ข้อความไม่มี "ติ๊กยืนยัน")

- [ ] **Step 3: แก้ `closeChecklist`**

ใน `lib/tasks/timeline.js` แทน
```js
/** ปิดเรื่องต้องมี ≥1 ภาพผลงาน + บันทึกสรุป (README หน้าจอ 3) */
export function closeChecklist({ note, images } = {}) {
  const errors = [];
  if (!Array.isArray(images) || images.filter(Boolean).length === 0) errors.push("ต้องแนบภาพผลการดำเนินงานอย่างน้อย 1 ภาพ");
  if (!text(note)) errors.push("ต้องเขียนบันทึกสรุปการดำเนินงาน");
  return { ok: errors.length === 0, errors };
}
```
ด้วย
```js
/**
 * เงื่อนไขปิดเรื่อง: บันทึกสรุปบังคับเสมอ · ภาพผลงาน ≥1 หรือติ๊กยืนยันปิดโดยไม่มีภาพ
 * (`confirmNoImages` — บางเรื่องเป็นแค่การสอบถามข้อมูล ไม่มีงานภาคสนามให้ถ่าย, 2026-09-09)
 */
export function closeChecklist({ note, images, confirmNoImages } = {}) {
  const errors = [];
  const imageCount = Array.isArray(images) ? images.filter(Boolean).length : 0;
  if (imageCount === 0 && confirmNoImages !== true)
    errors.push("ยังไม่ได้แนบภาพผลงาน — ติ๊กยืนยันหากเรื่องนี้ไม่จำเป็นต้องมีภาพ (เช่น เป็นการสอบถามข้อมูล)");
  if (!text(note)) errors.push("ต้องเขียนบันทึกสรุปการดำเนินงาน");
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run lib/tasks/__tests__/timeline.test.js`
Expected: ทุกเคสผ่าน (ไฟล์นี้มีเทสของ buildTimeline/stageChangePlan/blockedUpdate ร่วมอยู่ — ต้องเขียวทั้งไฟล์)

- [ ] **Step 5: `npm test` ทั้งชุด → เขียว · Commit**

```bash
git branch --show-current   # ต้องได้ close-without-image
git add lib/tasks/timeline.js lib/tasks/__tests__/timeline.test.js
git commit -m "feat(tasks): closeChecklist ยอมปิดเรื่องไม่มีภาพเมื่อติ๊กยืนยัน (confirmNoImages)"
```

---

### Task 2: Server รับ `confirmNoImages`

**Files:**
- Modify: `pages/api/tasks/[assignmentId].ts:245-249`

- [ ] **Step 1: ส่ง flag เข้า checklist**

แทน
```ts
      const note = str(body.note);
      const images = httpsList(body.images);
      const check = closeChecklist({ note, images });
```
ด้วย
```ts
      const note = str(body.note);
      const images = httpsList(body.images);
      // ปิดโดยไม่มีภาพต้องยืนยันชัดเจน (เช่น เรื่องสอบถามข้อมูล) — เช็คฝั่ง server ด้วย กันยิง API ข้าม UI
      const confirmNoImages = body.confirmNoImages === true;
      const check = closeChecklist({ note, images, confirmNoImages });
```
(บรรทัด 400 / ส่วนที่เหลือของ close path ไม่แตะ — เรื่องที่ปิดไม่มีรูปได้ `solutionImages` ว่างตามจริง)

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep assignmentId ; echo tsc-done` → เห็นแค่ `tsc-done`
Run: `npx next lint --file "pages/api/tasks/[assignmentId].ts"` → ไม่มี error

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add "pages/api/tasks/[assignmentId].ts"
git commit -m "feat(tasks): API close รับ confirmNoImages — ไม่มีภาพต้องส่ง flag ยืนยัน"
```

---

### Task 3: Modal — checkbox ยืนยัน + label ภาพเป็น optional

**Files:**
- Modify: `components/tasks/CloseTaskModal.tsx`

- [ ] **Step 1: header comment + type**

แทนบรรทัด 2
```tsx
// modal "ปิดเรื่อง" (README หน้าจอ 3): ต้องมี ≥1 ภาพผลงาน + บันทึกสรุป · เลือกวิธีแก้ไขจาก AdminOption ของประเภทเรื่อง
```
ด้วย
```tsx
// modal "ปิดเรื่อง" (README หน้าจอ 3): บันทึกสรุปบังคับ · ภาพ ≥1 หรือติ๊กยืนยันปิดโดยไม่มีภาพ · เลือกวิธีแก้ไขจาก AdminOption ของประเภทเรื่อง
```
และแทน
```tsx
export interface ClosePayload {
  note: string;
  images: string[];
  solution: string[];
}
```
ด้วย
```tsx
export interface ClosePayload {
  note: string;
  images: string[];
  solution: string[];
  /** ยืนยันปิดเรื่องโดยไม่แนบภาพ (มีความหมายเฉพาะเมื่อ images ว่าง) */
  confirmNoImages: boolean;
}
```

- [ ] **Step 2: state + reset + checklist + payload**

แทน
```tsx
  const [uploading, setUploading] = useState(false);
```
ด้วย
```tsx
  const [uploading, setUploading] = useState(false);
  const [confirmNoImages, setConfirmNoImages] = useState(false);
```
ใน `useEffect` แทน
```tsx
    setSolution(initialSolution);
```
ด้วย
```tsx
    setSolution(initialSolution);
    setConfirmNoImages(false);
```
แทน
```tsx
  const check = closeChecklist({ note, images }) as { ok: boolean; errors: string[] };
```
ด้วย
```tsx
  const check = closeChecklist({ note, images, confirmNoImages }) as { ok: boolean; errors: string[] };
```
แทน
```tsx
          if (canSubmit) onSubmit({ note: note.trim(), images, solution });
```
ด้วย
```tsx
          if (canSubmit) onSubmit({ note: note.trim(), images, solution, confirmNoImages: images.length === 0 && confirmNoImages });
```

- [ ] **Step 3: label ภาพ + checkbox**

แทน
```tsx
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">ภาพผลการดำเนินงาน <span className="text-tk-overdue-ink">*</span> (อย่างน้อย 1 ภาพ)</span>
            <ImageUploads key={uploaderKey} maxImages={3} initialImages={[]} onChange={(urls: string[]) => setImages(urls)} onUploadingChange={setUploading} />
          </div>
```
ด้วย
```tsx
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">ภาพผลการดำเนินงาน (ถ้ามี)</span>
            <ImageUploads key={uploaderKey} maxImages={3} initialImages={[]} onChange={(urls: string[]) => setImages(urls)} onUploadingChange={setUploading} />
            {images.length === 0 && (
              <label className="mt-2 flex items-start gap-2 rounded-[10px] bg-tk-bg px-3 py-2 text-[12.5px] text-tk-ink-4">
                <input
                  type="checkbox"
                  checked={confirmNoImages}
                  onChange={(e) => setConfirmNoImages(e.target.checked)}
                  className="checkbox checkbox-xs mt-0.5"
                />
                <span>ปิดเรื่องโดยไม่แนบภาพผลงาน (เช่น เป็นการสอบถามข้อมูล / ไม่มีงานภาคสนาม)</span>
              </label>
            )}
          </div>
```

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "CloseTaskModal|my-tasks" ; echo tsc-done` → เห็นแค่ `tsc-done`
(ผู้เรียกที่ `pages/admin/my-tasks/[assignmentId].tsx:181` ทำ `{ action: 'close', ...payload }` — ได้ `confirmNoImages` อัตโนมัติ ไม่ต้องแก้ · ถ้า tsc ฟ้องที่ไฟล์นั้น ให้อ่าน error แล้วรายงาน อย่าแก้เกินจุดที่ฟ้อง)
Run: `npx next lint --file components/tasks/CloseTaskModal.tsx` → ไม่มี error

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add components/tasks/CloseTaskModal.tsx
git commit -m "feat(tasks): modal ปิดเรื่อง — ภาพเป็น optional + checkbox ยืนยันเมื่อไม่มีภาพ"
```

---

### Task 4: เอกสาร + ยืนยันฝั่งประชาชนรองรับรูปว่าง

**Files:**
- Modify: `docs/modules/tasks.md:23,126`

- [ ] **Step 1: แก้เอกสาร 2 จุด**

บรรทัด 23 แทนท่อน
```md
ปุ่มปิดเรื่อง (`CloseTaskModal` ≥1 ภาพ + สรุป + วิธีแก้ไขจาก AdminOption)
```
ด้วย
```md
ปุ่มปิดเรื่อง (`CloseTaskModal` สรุปบังคับ · ภาพ optional — ไม่มีภาพต้องติ๊กยืนยัน `confirmNoImages` เช่น เรื่องสอบถามข้อมูล + วิธีแก้ไขจาก AdminOption)
```
บรรทัด 126 แทนท่อน
```md
ขั้น "ปิดเรื่อง" ต้องผ่าน `close` (ภาพ ≥1 + สรุป) เท่านั้น
```
ด้วย
```md
ขั้น "ปิดเรื่อง" ต้องผ่าน `close` (สรุปบังคับ · ภาพ ≥1 หรือส่ง `confirmNoImages: true` — กติกาที่ `closeChecklist`) เท่านั้น
```

- [ ] **Step 2: ยืนยันฝั่งประชาชนรองรับ `solutionImages` ว่าง (อ่านอย่างเดียว — คาดว่าไม่ต้องแก้โค้ด)**

ตรวจ 3 จุดแล้วรายงานผล:
1. `pages/status/[id].tsx:348` — `BeforeAfter` เรนเดอร์เฉพาะเมื่อ `(assignment?.solutionImages?.length ?? 0) > 0` → ไม่มีรูปก็ไม่มี section นี้ ✓
2. `lib/complaintNotify.js:44` — `firstHttps(closingAssignment?.solutionImages)` คืน null เมื่อว่าง → การ์ด LINE ปิดงานไม่มีรูป ✓ (เปิดไฟล์ดูว่า null ถูกใช้แบบ conditional จริง)
3. `pages/api/integrations/line-webhook.ts:478` — `?.find(...) ?? null` ✓ (ดูต่อว่าตัวแปร `solutionImage` ที่ null ไม่ทำการ์ดพัง)
ถ้าพบจุดที่รูป null แล้วพัง ให้หยุดและรายงาน (DONE_WITH_CONCERNS) — อย่าแก้เอง

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add docs/modules/tasks.md
git commit -m "docs(tasks): กติกาปิดเรื่องใหม่ — ภาพ optional + ติ๊กยืนยันเมื่อไม่มีภาพ"
```

---

### Task 5: ตรวจรับรวม

- [ ] **Step 1:** `npm test` → เขียวทั้งชุด · `npx tsc --noEmit -p tsconfig.json` → ว่าง · `npm run lint` → ไม่มี error
- [ ] **Step 2:** `npm run build` (ห้ามรันขณะ dev server ของ user เปิดอยู่ — เช็ค `lsof -iTCP:3000 -sTCP:LISTEN` ก่อน ถ้ามีให้ข้ามและรายงาน) แล้ว `rm -rf .next` หลังเสร็จ
- [ ] **Step 3:** `git log --oneline origin/main..HEAD` — commit ครบตาม Task 1–4 (+ spec/plan)
- [ ] **Step 4:** ส่งมอบด้วย skill `superpowers:finishing-a-development-branch` (PR เข้า **main** — merge = live ทันทีบน Railway) · ทดสอบมือหลัง deploy: ปิดเรื่องแบบมีรูป = เดิม · แบบไม่มีรูป: ไม่ติ๊ก → ปุ่มกดแล้วเห็น error, ติ๊ก → ปิดสำเร็จ, `/status/<id>` แสดงสรุปโดยไม่มีส่วนรูป

---

## Self-review notes

- Spec ครบ: กติกา→Task 1 · server→Task 2 · UI→Task 3 · ฝั่งประชาชน→Task 4 Step 2 · เทส→Task 1 · เอกสาร→Task 4 · การตรวจรับ→Task 5
- Type consistency: `confirmNoImages` (boolean) ชื่อเดียวกันทุกชั้น — `closeChecklist` param · `body.confirmNoImages` · `ClosePayload.confirmNoImages` · state ใน modal
- ผู้เรียก modal ไม่ต้องแก้เพราะ spread payload — Task 3 Step 4 มีคำสั่งตรวจ tsc ครอบไฟล์นั้นกันพลาด
