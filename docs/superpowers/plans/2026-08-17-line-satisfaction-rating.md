# แบบประเมินความพึงพอใจผ่าน LINE OA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้เจ้าของเรื่องกดให้คะแนนความพึงพอใจ 1-5 ดาวได้จากการ์ด LINE ที่ส่งตอนปิดงาน โดยไม่ต้องเข้าเว็บ

**Architecture:** แนบแถบปุ่ม postback ⭐1-5 ท้ายการ์ดสถานะที่ `linePush` ส่งอยู่แล้ว (ไม่เพิ่มจำนวนข้อความ) → webhook รับ event `postback` แล้ว upsert ลง collection `satisfactions` เดิมโดยติดฟิลด์ `source: 'line'` + `lineUserId` → ข้อความอิสระที่พิมพ์ตามมาภายใน 10 นาทีถูกเก็บเป็น `comment` โดยวาง logic ไว้**หลัง pattern คำสั่งทั้งหมด ก่อน default help** จึงไม่ชนคำสั่งเดิม logic ล้วนแยกอยู่ `lib/satisfaction/lineRating.js` (มีเทส) ส่วน I/O อยู่ `lib/satisfaction/record.js` ที่เดียว

**Tech Stack:** Next.js 15 Pages Router · Mongoose · LINE Messaging API (Flex + postback) · vitest

**Spec:** `docs/superpowers/specs/2026-08-17-line-satisfaction-rating-design.md`

**Branch:** `feat/line-satisfaction-rating` (แตกจาก `origin/main` แล้ว มี commit spec อยู่)

---

## หมายเหตุที่ต่างจาก spec (ตัดสินตอนทำแผน)

1. **spec บอก "ไม่ต้อง migration" — ไม่จริง** แถวเดิม 48 แถวใน Mongo **ไม่มีฟิลด์ `source` เลย**
   (mongoose default ทำงานตอนเขียนเท่านั้น ไม่ย้อนไปเติมให้เอกสารเดิม) ⇒ ถ้า query `{ source: 'public' }`
   ตรง ๆ จะนับแถวเดิมไม่เจอ **จึงเพิ่ม Task 3: backfill script** (รันครั้งเดียว มี `--yes` guard)
2. spec ระบุ helper ชื่อ `isWithinCommentWindow()` — แผนนี้ใช้ `commentWindowStart(now)` แทน
   เพราะการกรองช่วงเวลาทำใน query ของ Mongo (`createdAt: { $gte: ... }`) ไม่ได้ทำในโค้ด
   ผลลัพธ์เหมือนกันและไม่มีฟังก์ชันตายค้างไว้

---

## File Structure

**สร้างใหม่**

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `lib/satisfaction/lineRating.js` | logic ล้วน ไม่มี I/O: สร้าง/แกะ postback data, ช่วงเวลารับความเห็น, ตัดแต่งข้อความ |
| `lib/satisfaction/__tests__/lineRating.test.js` | เทส logic ข้างบน |
| `lib/satisfaction/__tests__/model.test.js` | เทสว่า schema มีฟิลด์/ค่า default/index ตามดีไซน์ |
| `lib/satisfaction/record.js` | I/O ที่เดียวของ collection `satisfactions` (ทั้งฝั่งเว็บและ LINE) |
| `scripts/backfill-satisfaction-source.mjs` | เติม `source: 'public'` ให้แถวเดิม รันครั้งเดียว |

**แก้ไข**

| ไฟล์ | แก้อะไร |
|---|---|
| `models/Satisfaction.js` | เพิ่ม `source`, `lineUserId`, partial unique index |
| `lib/lineMessaging.ts` | แถบปุ่มดาวในการ์ด + ข้อความขอบคุณ |
| `pages/api/integrations/line-webhook.ts` | รับ event `postback` · ดักความเห็น · แนบแถบดาวในการ์ดสถานะ |
| `pages/api/submittedreports/update-status.js` | แนบแถบดาวตอนปิดงาน |
| `pages/api/satisfaction/create.js` | เรียก `recordPublicRating()` แทน logic ในไฟล์ |
| `pages/api/satisfaction/count.js` | รองรับ `?source=` |
| `pages/api/satisfaction/stats.js` | คืน `bySource` เพิ่ม |
| `components/complaints/CardOfficail.js` | นับเฉพาะ `source=public` |
| `pages/admin/dashboard.jsx` | แสดงจำนวน/ค่าเฉลี่ยที่มาจาก LINE |
| `docs/modules/satisfaction.md`, `docs/modules/README.md`, `CLAUDE.md` | เอกสาร |

---

## Task 1: logic ล้วนของ postback (`lib/satisfaction/lineRating.js`)

**Files:**
- Create: `lib/satisfaction/lineRating.js`
- Test: `lib/satisfaction/__tests__/lineRating.test.js`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `lib/satisfaction/__tests__/lineRating.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  MAX_COMMENT_LENGTH,
  RATING_COMMENT_WINDOW_MS,
  buildRatingPostbackData,
  commentWindowStart,
  parseRatingPostback,
  sanitizeComment,
  starText,
} from '../lineRating';

describe('buildRatingPostbackData / parseRatingPostback', () => {
  it('สร้างแล้วแกะกลับได้ค่าเดิม', () => {
    const data = buildRatingPostbackData('TKC-690006', 4);
    expect(data).toBe('action=sat_rate&cid=TKC-690006&score=4');
    expect(parseRatingPostback(data)).toEqual({ complaintCode: 'TKC-690006', score: 4 });
  });

  it('รับเลขเรื่องตัวพิมพ์เล็กแล้วคืนเป็นตัวพิมพ์ใหญ่', () => {
    expect(parseRatingPostback('action=sat_rate&cid=tkc-690006&score=1')).toEqual({
      complaintCode: 'TKC-690006',
      score: 1,
    });
  });

  it('คืน null เมื่อ action ไม่ใช่ของแบบประเมิน', () => {
    expect(parseRatingPostback('action=other&cid=TKC-690006&score=4')).toBeNull();
  });

  it('คืน null เมื่อคะแนนอยู่นอกช่วง 1-5 หรือไม่ใช่จำนวนเต็ม', () => {
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=0')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=6')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=4.5')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=ห้า')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006')).toBeNull();
  });

  it('คืน null เมื่อเลขเรื่องผิดรูปแบบหรือไม่มี', () => {
    expect(parseRatingPostback('action=sat_rate&cid=ABC-1&score=4')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-69&score=4')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&score=4')).toBeNull();
  });

  it('คืน null เมื่อ data ว่างหรือไม่ใช่ string', () => {
    expect(parseRatingPostback('')).toBeNull();
    expect(parseRatingPostback(undefined)).toBeNull();
    expect(parseRatingPostback(null)).toBeNull();
    expect(parseRatingPostback(42)).toBeNull();
  });
});

describe('commentWindowStart', () => {
  it('ย้อนหลังจากเวลาที่ให้มาเท่ากับความกว้างของหน้าต่าง', () => {
    const now = new Date('2026-08-17T10:00:00.000Z');
    expect(commentWindowStart(now).toISOString()).toBe('2026-08-17T09:50:00.000Z');
    expect(RATING_COMMENT_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

describe('sanitizeComment', () => {
  it('ตัดช่องว่างหัวท้าย', () => {
    expect(sanitizeComment('  ดีมากครับ  ')).toBe('ดีมากครับ');
  });

  it('คืน null เมื่อว่างหรือมีแต่ช่องว่าง', () => {
    expect(sanitizeComment('')).toBeNull();
    expect(sanitizeComment('   \n ')).toBeNull();
    expect(sanitizeComment(undefined)).toBeNull();
    expect(sanitizeComment(123)).toBeNull();
  });

  it('ตัดความยาวส่วนเกินทิ้ง', () => {
    const long = 'ก'.repeat(MAX_COMMENT_LENGTH + 50);
    expect(sanitizeComment(long)).toHaveLength(MAX_COMMENT_LENGTH);
  });
});

describe('starText', () => {
  it('แปลงคะแนนเป็นดาว', () => {
    expect(starText(3)).toBe('⭐⭐⭐');
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

รัน: `npx vitest run lib/satisfaction/__tests__/lineRating.test.js`
คาดหวัง: FAIL — `Failed to load ../lineRating` (ยังไม่มีไฟล์)

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/satisfaction/lineRating.js`:

```js
// lib/satisfaction/lineRating.js
// logic ล้วนของแบบประเมินความพึงพอใจผ่าน LINE — ห้ามมี I/O ในไฟล์นี้ (เทสด้วย vitest)

/** ช่วงเวลาที่ยังรับ "ข้อความถัดไป" เป็นความเห็นของคะแนนที่เพิ่งกด */
export const RATING_COMMENT_WINDOW_MS = 10 * 60 * 1000;

/** ความยาวความเห็นสูงสุดที่เก็บ (ส่วนเกินตัดทิ้ง) */
export const MAX_COMMENT_LENGTH = 500;

const COMPLAINT_CODE_RE = /^TKC-\d{4,}$/;

/** สร้าง postback data ของปุ่มดาว — รูปแบบ query string อ่านออกและตรวจสอบได้ */
export function buildRatingPostbackData(complaintCode, score) {
  return `action=sat_rate&cid=${complaintCode}&score=${score}`;
}

/**
 * แกะ postback data — คืน null ถ้าไม่ใช่ของแบบประเมินหรือค่าไม่ถูกต้อง
 * (payload ปลอมต้องไม่สร้างแถวขยะในฐานข้อมูล)
 */
export function parseRatingPostback(data) {
  if (typeof data !== 'string' || !data) return null;

  const params = new URLSearchParams(data);
  if (params.get('action') !== 'sat_rate') return null;

  const complaintCode = (params.get('cid') || '').toUpperCase();
  if (!COMPLAINT_CODE_RE.test(complaintCode)) return null;

  const rawScore = params.get('score') || '';
  if (!/^[1-5]$/.test(rawScore)) return null;

  return { complaintCode, score: Number(rawScore) };
}

/** ขอบล่างของช่วงเวลารับความเห็น — ใช้เป็น $gte ใน query */
export function commentWindowStart(now = new Date()) {
  return new Date(new Date(now).getTime() - RATING_COMMENT_WINDOW_MS);
}

/** ตัดแต่งความเห็นก่อนบันทึก — คืน null ถ้าไม่มีเนื้อความ */
export function sanitizeComment(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_COMMENT_LENGTH);
}

/** 3 → "⭐⭐⭐" */
export function starText(score) {
  return '⭐'.repeat(score);
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

รัน: `npx vitest run lib/satisfaction/__tests__/lineRating.test.js`
คาดหวัง: PASS ทุกเคส (5 describe)

- [ ] **Step 5: commit**

```bash
git add lib/satisfaction/lineRating.js lib/satisfaction/__tests__/lineRating.test.js
git commit -m "feat(satisfaction): logic ล้วนของ postback ให้คะแนนผ่าน LINE + เทส"
```

---

## Task 2: เพิ่มฟิลด์ `source` / `lineUserId` ใน model

**Files:**
- Modify: `models/Satisfaction.js`
- Test: `lib/satisfaction/__tests__/model.test.js`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `lib/satisfaction/__tests__/model.test.js`:

```js
import { describe, expect, it } from 'vitest';
import Satisfaction from '@/models/Satisfaction';

describe('Satisfaction schema', () => {
  it('มีฟิลด์ source ค่า default เป็น public และรับได้แค่ public|line', () => {
    const path = Satisfaction.schema.path('source');
    expect(path).toBeDefined();
    expect(path.options.default).toBe('public');
    expect(path.options.enum).toEqual(['public', 'line']);
  });

  it('มีฟิลด์ lineUserId ค่า default เป็น null', () => {
    const path = Satisfaction.schema.path('lineUserId');
    expect(path).toBeDefined();
    expect(path.options.default).toBeNull();
  });

  it('มี partial unique index กันให้คะแนนซ้ำ 1 LINE user ต่อ 1 เรื่อง', () => {
    const found = Satisfaction.schema.indexes().find(
      ([fields]) => fields.complaintId === 1 && fields.lineUserId === 1
    );
    expect(found).toBeDefined();
    const [, options] = found;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toEqual({ lineUserId: { $type: 'string' } });
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

รัน: `npx vitest run lib/satisfaction/__tests__/model.test.js`
คาดหวัง: FAIL — `expected undefined to be defined` (ยังไม่มีฟิลด์ `source`)

- [ ] **Step 3: แก้ model**

แทนที่ทั้งไฟล์ `models/Satisfaction.js` ด้วย:

```js
import mongoose from "mongoose";

const SatisfactionSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Complaint",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: "",
  },
  // 'public' = ใครก็ได้ที่เปิดการ์ดเรื่องในหน้า /status แล้วกดให้คะแนน (สูงสุด 4 ครั้ง/เรื่อง)
  // 'line'   = คนที่ผูก LINE ไว้กับเรื่องนี้ กดจากการ์ดในแชท (1 ครั้ง/เรื่อง แก้ได้)
  //            ⚠️ การผูก lineUserId เป็นแบบ first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้
  //            'line' จึงแปลว่า "คนที่ผูก LINE กับเรื่องนี้" ไม่ใช่ "ยืนยันตัวตนแล้ว"
  source: {
    type: String,
    enum: ["public", "line"],
    default: "public",
    index: true,
  },
  lineUserId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 1 LINE user ให้คะแนนได้ 1 ครั้งต่อเรื่อง — กดซ้ำต้องอัปเดตแถวเดิม ไม่ใช่เพิ่มแถว
// partial: แถวฝั่งเว็บที่ lineUserId เป็น null ไม่เข้า index จึงยังซ้ำได้ตามโควตาเดิม
SatisfactionSchema.index(
  { complaintId: 1, lineUserId: 1 },
  { unique: true, partialFilterExpression: { lineUserId: { $type: "string" } } }
);

export default mongoose.models.Satisfaction || mongoose.model("Satisfaction", SatisfactionSchema);
```

- [ ] **Step 4: รันเทสทั้งชุดให้ผ่าน**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด (เทสเดิมของโมดูลอื่นต้องไม่พัง)

- [ ] **Step 5: commit**

```bash
git add models/Satisfaction.js lib/satisfaction/__tests__/model.test.js
git commit -m "feat(satisfaction): เพิ่ม source/lineUserId + partial unique index กันให้คะแนนซ้ำ"
```

---

## Task 3: backfill `source` ให้แถวเดิม

แถวเดิม 48 แถวไม่มีฟิลด์ `source` เลย (default ของ mongoose ทำงานตอนเขียนเท่านั้น)
ถ้าไม่เติม การนับ `{ source: 'public' }` ใน Task 7-8 จะนับไม่เจอ

**Files:**
- Create: `scripts/backfill-satisfaction-source.mjs`

- [ ] **Step 1: เขียนสคริปต์**

สร้าง `scripts/backfill-satisfaction-source.mjs`:

```js
// เติม source: 'public' + lineUserId: null ให้แถวเดิมใน satisfactions ที่ยังไม่มีฟิลด์
// รันครั้งเดียว: node --env-file=.env.local scripts/backfill-satisfaction-source.mjs [--yes]
import mongoose from 'mongoose';

const apply = process.argv.includes('--yes');

await mongoose.connect(process.env.MONGO_URI);
const col = mongoose.connection.db.collection('satisfactions');

const filter = { source: { $exists: false } };
const total = await col.countDocuments({});
const pending = await col.countDocuments(filter);

console.log(`แถวทั้งหมด: ${total}`);
console.log(`แถวที่ยังไม่มี source: ${pending}`);

if (!pending) {
  console.log('ไม่มีอะไรต้องเติม');
} else if (!apply) {
  console.log('DRY RUN — ใส่ --yes เพื่อเขียนจริง');
} else {
  const res = await col.updateMany(filter, { $set: { source: 'public', lineUserId: null } });
  console.log(`อัปเดตแล้ว ${res.modifiedCount} แถว`);
}

await mongoose.disconnect();
```

- [ ] **Step 2: รันแบบ dry-run ดูตัวเลขก่อน**

รัน: `node --env-file=.env.local scripts/backfill-satisfaction-source.mjs`
คาดหวัง: พิมพ์จำนวนแถวทั้งหมด/ที่ยังไม่มี `source` แล้วจบด้วย `DRY RUN — ใส่ --yes เพื่อเขียนจริง`

- [ ] **Step 3: รันจริง**

รัน: `node --env-file=.env.local scripts/backfill-satisfaction-source.mjs --yes`
คาดหวัง: `อัปเดตแล้ว <n> แถว`

- [ ] **Step 4: รันซ้ำเพื่อยืนยันว่า idempotent**

รัน: `node --env-file=.env.local scripts/backfill-satisfaction-source.mjs`
คาดหวัง: `แถวที่ยังไม่มี source: 0` และ `ไม่มีอะไรต้องเติม`

- [ ] **Step 5: commit**

```bash
git add scripts/backfill-satisfaction-source.mjs
git commit -m "chore(satisfaction): script เติม source ให้แถวเดิม (รันครั้งเดียว)"
```

---

## Task 4: ชั้น I/O ที่เดียว (`lib/satisfaction/record.js`)

**Files:**
- Create: `lib/satisfaction/record.js`
- Modify: `pages/api/satisfaction/create.js`

- [ ] **Step 1: เขียน `lib/satisfaction/record.js`**

```js
// lib/satisfaction/record.js
// จุดเดียวที่อ่าน/เขียน collection satisfactions — ทั้งฝั่งเว็บสาธารณะและฝั่ง LINE
// (รวมไว้ที่เดียวเพื่อให้ n8n notify และกติกาการนับคะแนนไม่แตกเป็นสองชุด)

import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";
import SubmittedReport from "@/models/SubmittedReport";
import { n8n } from "@/lib/n8nWebhook";
import { commentWindowStart, sanitizeComment } from "@/lib/satisfaction/lineRating";

/** คะแนนจากหน้าเว็บสาธารณะ — พฤติกรรมเดิมทุกอย่าง */
export async function recordPublicRating({ complaintId, rating, comment }) {
  await dbConnect();
  const created = await Satisfaction.create({
    complaintId,
    rating,
    comment: comment || "",
    source: "public",
    lineUserId: null,
  });
  // fire-and-forget
  n8n.satisfactionSubmitted({ complaintId: String(complaintId), rating, comment: comment || "" });
  return created;
}

/**
 * คะแนนจากปุ่มดาวในแชท LINE — 1 คน 1 คะแนนต่อเรื่อง กดซ้ำ = อัปเดตแถวเดิม
 * คืน { ok: false, reason: 'not_found' } ถ้าไม่พบเลขเรื่อง (เรื่องถูกลบ / cid ปลอม)
 */
export async function recordLineRating({ complaintCode, lineUserId, score }) {
  await dbConnect();

  const report = await SubmittedReport.findOne({ complaintId: complaintCode })
    .select("_id")
    .lean();
  if (!report) return { ok: false, reason: "not_found" };

  const existing = await Satisfaction.findOne({
    complaintId: report._id,
    lineUserId,
  }).lean();

  if (existing) {
    await Satisfaction.updateOne({ _id: existing._id }, { $set: { rating: score } });
    return { ok: true, updated: true };
  }

  await Satisfaction.create({
    complaintId: report._id,
    rating: score,
    comment: "",
    source: "line",
    lineUserId,
  });
  n8n.satisfactionSubmitted({ complaintId: String(report._id), rating: score, comment: "" });
  return { ok: true, updated: false };
}

/**
 * เก็บข้อความอิสระเป็นความเห็นของคะแนนที่เพิ่งกด (ถ้ายังอยู่ในช่วงเวลาและยังไม่มีความเห็น)
 * คืน true = เก็บแล้ว · false = ไม่มีคะแนนรอความเห็น ให้ caller ทำงานเดิมต่อ
 */
export async function attachPendingComment({ lineUserId, text, now = new Date() }) {
  if (!lineUserId) return false;
  const comment = sanitizeComment(text);
  if (!comment) return false;

  await dbConnect();
  const pending = await Satisfaction.findOne({
    lineUserId,
    source: "line",
    comment: "",
    createdAt: { $gte: commentWindowStart(now) },
  }).sort({ createdAt: -1 });
  if (!pending) return false;

  pending.comment = comment;
  await pending.save();
  return true;
}

/** คะแนนที่ LINE user นี้เคยให้เรื่องนี้ — ใช้ตัดสินว่าจะแนบปุ่มดาวหรือแสดงคะแนนเดิม */
export async function findLineRating({ complaintObjectId, lineUserId }) {
  if (!complaintObjectId || !lineUserId) return null;
  await dbConnect();
  return Satisfaction.findOne({
    complaintId: complaintObjectId,
    lineUserId,
    source: "line",
  })
    .select("rating")
    .lean();
}
```

- [ ] **Step 2: ให้ API เว็บเรียกผ่าน record.js**

แทนที่ทั้งไฟล์ `pages/api/satisfaction/create.js` ด้วย:

```js
import { recordPublicRating } from "@/lib/satisfaction/record";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, rating, comment } = req.body;

  if (!complaintId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const newSatisfaction = await recordPublicRating({ complaintId, rating, comment });
    return res.status(201).json({ success: true, data: newSatisfaction });
  } catch (error) {
    console.error("Error saving satisfaction:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step 3: ตรวจว่าไม่มีที่อื่นเขียน Satisfaction ตรง ๆ อีก**

รัน: `grep -rn "Satisfaction.create\|new Satisfaction" pages lib components`
คาดหวัง: เจอที่ `lib/satisfaction/record.js` ที่เดียว

- [ ] **Step 4: lint**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่จากไฟล์ที่แตะ

- [ ] **Step 5: commit**

```bash
git add lib/satisfaction/record.js pages/api/satisfaction/create.js
git commit -m "feat(satisfaction): รวม I/O ของ satisfactions ไว้ที่ lib/satisfaction/record.js"
```

---

## Task 5: แถบปุ่มดาว + ข้อความขอบคุณใน `lib/lineMessaging.ts`

**Files:**
- Modify: `lib/lineMessaging.ts`

- [ ] **Step 1: เพิ่ม import และ helper สร้างแถบปุ่ม**

เพิ่ม import ใต้บรรทัด `import { getAdminGroupId } from './lineSettings';`:

```ts
import { buildRatingPostbackData, starText } from './satisfaction/lineRating';
```

เพิ่มต่อท้ายส่วน `// ---------- Helpers ----------` (ใต้ `formatThaiDateTime`):

```ts
/** ข้อมูลแถบให้คะแนนท้ายการ์ดสถานะ */
export interface RatingRequest {
  /** เลขเรื่องแบบ TKC-690006 (ไม่ใช่ ObjectId) */
  complaintCode: string;
  /** คะแนนที่คนนี้เคยให้ไว้ — มีค่า = แสดงคะแนนเดิมแทนปุ่ม */
  current?: number | null;
}

/**
 * แถบ "พอใจกับการแก้ไขแค่ไหน?" + ปุ่ม postback 1-5 ดาว
 * แนบท้าย body ของ bubble เดิม ไม่สร้าง message ใบใหม่ (LINE OA นับโควตาเป็นรายข้อความ)
 */
function ratingContents(rating?: RatingRequest | null): Record<string, unknown>[] {
  if (!rating) return [];

  if (rating.current) {
    return [
      { type: 'separator' },
      {
        type: 'text',
        text: `ให้คะแนนไว้แล้ว ${starText(rating.current)}`,
        size: 'sm',
        color: '#f59e0b',
      },
    ];
  }

  return [
    { type: 'separator' },
    {
      type: 'text',
      text: 'พอใจกับการแก้ไขแค่ไหน?',
      size: 'sm',
      weight: 'bold',
      color: '#111111',
    },
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'xs',
      contents: [1, 2, 3, 4, 5].map((score) => ({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'postback',
          label: `${score}⭐`,
          data: buildRatingPostbackData(rating.complaintCode, score),
          displayText: `ให้ ${score} ดาว`,
        },
      })),
    },
  ];
}

/** ข้อความตอบหลังกดดาว */
export function formatRatingThanks(score: number, updated = false): TextMessage {
  return {
    type: 'text',
    text: updated
      ? `อัปเดตเป็น ${starText(score)} แล้วครับ`
      : `ขอบคุณครับ ${starText(score)}\nอยากเล่าเพิ่มพิมพ์มาได้เลยตอนนี้ ถ้าไม่สะดวกข้ามได้ครับ`,
  };
}
```

- [ ] **Step 2: ให้ `formatStatusMessage` รับ `rating` แล้วแทรกแถบ**

ใน `formatStatusMessage` เพิ่มฟิลด์ในชนิดพารามิเตอร์ (ต่อจาก `note?: string;`):

```ts
  rating?: RatingRequest | null;
```

แก้บรรทัด destructure ให้เป็น:

```ts
  const { complaintId, fullName, category, status, updatedAt, solution, note, rating } = complaint;
```

ใน `body.contents` แทรก `...ratingContents(rating),` **ต่อจาก `...fixContents,`** (ก่อน `{ type: 'separator' },` ที่คั่นบรรทัดเวลาอัปเดต):

```ts
          ...fixContents,
          ...ratingContents(rating),
          { type: 'separator' },
```

- [ ] **Step 3: typecheck**

รัน: `npx tsc --noEmit`
คาดหวัง: exit 0 ไม่มี error

- [ ] **Step 4: commit**

```bash
git add lib/lineMessaging.ts
git commit -m "feat(line): แถบปุ่มให้คะแนน 1-5 ดาว (postback) ในการ์ดสถานะ"
```

---

## Task 6: webhook รับ postback + ดักความเห็น + แนบปุ่มในการ์ดสถานะ

**Files:**
- Modify: `pages/api/integrations/line-webhook.ts`

- [ ] **Step 1: เพิ่ม import**

แก้บล็อก import จาก `@/lib/lineMessaging` ให้มี `formatRatingThanks` และเพิ่ม import ของ record/lineRating:

```ts
import {
  lineReply,
  formatStatusMessage,
  formatRatingThanks,
  formatThaiDateTime,
  notFoundMessage,
  helpMessage,
  buildMessages,
} from '@/lib/lineMessaging';
import { parseRatingPostback } from '@/lib/satisfaction/lineRating';
import {
  attachPendingComment,
  findLineRating,
  recordLineRating,
} from '@/lib/satisfaction/record';
```

- [ ] **Step 2: เพิ่มชนิดของ postback event**

ในส่วน `// ---------- Types ----------` เพิ่ม interface และฟิลด์:

```ts
interface LinePostback {
  data: string;
}
```

แล้วเพิ่มบรรทัด `postback?: LinePostback;` ใน `interface LineEvent` (ต่อจาก `message?: LineTextContent;`)

- [ ] **Step 3: รับ event postback ใน `handleEvent`**

แทรกบล็อกนี้**ต่อจาก**บล็อก `if (event.type === 'follow') { ... }` และ**ก่อน**บรรทัด
`if (event.type !== 'message' || event.message?.type !== 'text') return;`:

```ts
  // กดดาวให้คะแนนความพึงพอใจจากการ์ดในแชท — เฉพาะแชท 1:1
  // (ในกลุ่มเจ้าหน้าที่ไม่แนบปุ่มอยู่แล้ว แต่กันไว้อีกชั้นไม่ให้คะแนนหลุดจากบริบทกลุ่ม)
  if (event.type === 'postback') {
    if (!isGroupChat) {
      await handleRatingPostback(event.replyToken, event.source?.userId, event.postback?.data);
    }
    return;
  }
```

- [ ] **Step 4: เขียน `handleRatingPostback`**

เพิ่มฟังก์ชันนี้ต่อจาก `handleMyCases` (ก่อน comment block ของ `buildStatusMessages`):

```ts
/**
 * ผู้ใช้กดปุ่มดาวในการ์ด — บันทึกคะแนนแล้วชวนพิมพ์ความเห็นต่อ
 * payload ที่แกะไม่ผ่าน (ปลอม/เพี้ยน) ให้เงียบไปเลย ไม่ตอบอะไร
 */
async function handleRatingPostback(
  replyToken: string,
  userId: string | undefined,
  data: string | undefined
): Promise<void> {
  const parsed = parseRatingPostback(data);
  if (!parsed || !userId) return;

  try {
    const result = await recordLineRating({
      complaintCode: parsed.complaintCode,
      lineUserId: userId,
      score: parsed.score,
    });

    if (!result.ok) {
      await lineReply(replyToken, [notFoundMessage(parsed.complaintCode)]);
      return;
    }

    await lineReply(replyToken, [formatRatingThanks(parsed.score, result.updated)]);
  } catch (err) {
    console.error('[LINE] Rating postback error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}
```

- [ ] **Step 5: ดักความเห็นก่อน default help**

ใน `handleEvent` แทรกบล็อกนี้ **ต่อจาก**บล็อก `ช่วยเหลือ / welcome` และ **ก่อน** `// default: แนะนำวิธีใช้`:

```ts
  // ความเห็นต่อท้ายคะแนนที่เพิ่งกด (ภายใน 10 นาที)
  // ต้องอยู่ "หลัง pattern คำสั่งทั้งหมด" เพื่อไม่แย่งข้อความค้นหาเลขเรื่อง/คำสั่งอื่น
  if (userId && (await attachPendingComment({ lineUserId: userId, text }))) {
    await lineReply(event.replyToken, [
      { type: 'text', text: 'รับความเห็นแล้ว ขอบคุณที่ช่วยให้เราทำงานดีขึ้นครับ' },
    ]);
    return;
  }
```

- [ ] **Step 6: แนบแถบดาวในการ์ดสถานะ**

ใน `buildStatusMessages` เพิ่มก่อนบรรทัด `const safeComplaint = {`:

```ts
  // แถบให้คะแนน: เฉพาะเรื่องที่ปิดงานแล้ว ฝั่งประชาชน และรู้ว่าปลายทางเป็น LINE คนไหน
  let rating: RatingRequest | undefined;
  if (!staffView && bindUserId && complaint.status === 'ดำเนินการเสร็จสิ้น') {
    const existingRating = await findLineRating({
      complaintObjectId: complaint._id,
      lineUserId: bindUserId,
    });
    rating = { complaintCode: complaint.complaintId, current: existingRating?.rating ?? null };
  }
```

เพิ่ม `rating,` เข้าไปใน object `safeComplaint`:

```ts
  const safeComplaint = {
    ...complaint,
    fullName: displayName,
    solution,
    note,
    rating,
  };
```

และเพิ่ม `RatingRequest` ใน import จาก `@/lib/lineMessaging`:

```ts
import type { RatingRequest } from '@/lib/lineMessaging';
```

- [ ] **Step 7: ให้การ์ดหลังยืนยันเบอร์ 4 ตัวท้ายมีปุ่มด้วย**

ใน `handleRebind` แก้บรรทัด `const result = await buildStatusMessages(complaintId);` เป็น:

```ts
    const result = await buildStatusMessages(complaintId, { bindUserId: userId });
```

- [ ] **Step 8: typecheck**

รัน: `npx tsc --noEmit`
คาดหวัง: exit 0

- [ ] **Step 9: commit**

```bash
git add pages/api/integrations/line-webhook.ts
git commit -m "feat(line): รับ postback ให้คะแนน + ดักความเห็นใน 10 นาที + แนบปุ่มในการ์ดสถานะ"
```

---

## Task 7: แนบแถบดาวตอนปิดงาน

**Files:**
- Modify: `pages/api/submittedreports/update-status.js`

- [ ] **Step 1: เพิ่ม import**

เพิ่มต่อจาก import เดิมด้านบนไฟล์:

```js
import { findLineRating } from "@/lib/satisfaction/record";
```

- [ ] **Step 2: หาคะแนนเดิมก่อน push แล้วส่งเข้าการ์ด**

ในบล็อก `if (existing?.lineUserId) { ... }` เพิ่มบรรทัดนี้ก่อนเรียก `linePush(`:

```js
        // เคยให้คะแนนไว้แล้วหรือยัง — เคยแล้วการ์ดจะโชว์คะแนนเดิมแทนปุ่ม
        const existingRating =
          status === CLOSED_STATUS
            ? await findLineRating({
                complaintObjectId: existing._id,
                lineUserId: existing.lineUserId,
              })
            : null;
```

แล้วแก้ object ที่ส่งให้ `formatStatusMessage` ให้ส่วน `...(status === CLOSED_STATUS ? ... )` เป็น:

```js
              ...(status === CLOSED_STATUS
                ? {
                    solution: closingAssignment?.solution,
                    note: closingAssignment?.note,
                    rating: {
                      complaintCode: updated.complaintId || String(complaintId),
                      current: existingRating?.rating ?? null,
                    },
                  }
                : {}),
```

- [ ] **Step 3: lint**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่

- [ ] **Step 4: commit**

```bash
git add pages/api/submittedreports/update-status.js
git commit -m "feat(line): แนบแถบให้คะแนนไปกับการ์ดปิดงาน"
```

---

## Task 8: แยกโควตาคะแนนสาธารณะ (`count.js` + การ์ดหน้าเว็บ)

**Files:**
- Modify: `pages/api/satisfaction/count.js`
- Modify: `components/complaints/CardOfficail.js:167`

- [ ] **Step 1: ให้ count รองรับ `?source=`**

แทนที่บล็อก `try` ใน `pages/api/satisfaction/count.js` ด้วย:

```js
  try {
    const query = { complaintId };
    if (source === "public" || source === "line") {
      query.source = source;
    }
    const count = await Satisfaction.countDocuments(query);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Error counting satisfaction:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
```

และแก้บรรทัดดึง query ให้เป็น:

```js
  const { complaintId, source } = req.query;
```

- [ ] **Step 2: ให้การ์ดหน้าเว็บนับเฉพาะคะแนนสาธารณะ**

ใน `components/complaints/CardOfficail.js` แก้บรรทัด 167 เป็น:

```js
          const res = await fetch(`/api/satisfaction/count?complaintId=${props.probId}&source=public`);
```

- [ ] **Step 3: ตรวจด้วยมือ**

รัน: `npm run dev` แล้วเปิด `http://localhost:3000/status` → เปิดเรื่องที่ปิดงานแล้ว
คาดหวัง: ปุ่ม "ให้คะแนนความพึงพอใจ" และตัวนับ `(n/4 ครั้ง)` ยังทำงานเหมือนเดิม
(ถ้าเรื่องนั้นมีคะแนนจาก LINE อยู่ ตัวเลขต้องไม่รวมของ LINE)

- [ ] **Step 4: commit**

```bash
git add pages/api/satisfaction/count.js components/complaints/CardOfficail.js
git commit -m "feat(satisfaction): แยกโควตาคะแนนหน้าเว็บออกจากคะแนนที่มาทาง LINE"
```

---

## Task 9: สถิติแยกแหล่งที่มา (`stats.js` + dashboard)

**Files:**
- Modify: `pages/api/satisfaction/stats.js`
- Modify: `pages/admin/dashboard.jsx:760` และการ์ดความพึงพอใจ (~บรรทัด 1343)

- [ ] **Step 1: ให้ stats คืน `bySource`**

แทนที่บล็อก `try` ใน `pages/api/satisfaction/stats.js` ด้วย:

```js
    try {
      const satisfactions = await Satisfaction.find({}, { rating: 1, source: 1 }).lean();

      const emptyBySource = {
        public: { count: 0, average: 0 },
        line: { count: 0, average: 0 },
      };

      if (satisfactions.length === 0) {
        return res.status(200).json({
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          bySource: emptyBySource,
        });
      }

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const sums = { public: 0, line: 0 };
      const counts = { public: 0, line: 0 };

      satisfactions.forEach((s) => {
        if (ratingDistribution[s.rating] !== undefined) {
          ratingDistribution[s.rating]++;
        }
        // แถวที่ไม่มี source (ก่อน backfill) ถือเป็นคะแนนจากหน้าเว็บ
        const key = s.source === 'line' ? 'line' : 'public';
        sums[key] += s.rating;
        counts[key]++;
      });

      const totalRating = sums.public + sums.line;

      return res.status(200).json({
        averageRating: totalRating / satisfactions.length,
        totalRatings: satisfactions.length,
        ratingDistribution,
        bySource: {
          public: {
            count: counts.public,
            average: counts.public ? sums.public / counts.public : 0,
          },
          line: {
            count: counts.line,
            average: counts.line ? sums.line / counts.line : 0,
          },
        },
      });
    } catch (err) {
      console.error('❌ Failed to fetch satisfaction stats:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch satisfaction stats' });
    }
```

- [ ] **Step 2: เก็บค่าลง stats ของ dashboard**

ใน `pages/admin/dashboard.jsx` ฟังก์ชัน `calculateStats` เพิ่มบรรทัดต่อจาก `satisfaction: satisfactionData.averageRating || 0,`:

```js
      satisfactionByLine: satisfactionData.bySource?.line || { count: 0, average: 0 },
```

- [ ] **Step 3: แสดงผลในการ์ดความพึงพอใจ**

ในการ์ด Satisfaction เพิ่มบรรทัดต่อจาก `<p className="text-4xl font-bold ...">...</p>`:

```jsx
            {stats.satisfactionByLine?.count > 0 && (
              <p className="text-amber-100/80 text-xs mt-1">
                จากเจ้าของเรื่องผ่าน LINE {stats.satisfactionByLine.count} รายการ
                {' '}(เฉลี่ย {stats.satisfactionByLine.average.toFixed(1)})
              </p>
            )}
```

- [ ] **Step 4: ตรวจด้วยมือ**

รัน: `curl -s http://localhost:3000/api/satisfaction/stats | head -20` (ต้องมี `npm run dev` อยู่)
คาดหวัง: JSON มี `bySource.public.count` เท่ากับจำนวนคะแนนเดิม และ `bySource.line.count` เป็น 0 (ยังไม่มีใครกด)

- [ ] **Step 5: commit**

```bash
git add pages/api/satisfaction/stats.js pages/admin/dashboard.jsx
git commit -m "feat(satisfaction): สถิติแยก public/line + แสดงบน dashboard"
```

---

## Task 10: เอกสาร

**Files:**
- Modify: `docs/modules/satisfaction.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: อัปเดตเอกสารโมดูล**

ใน `docs/modules/satisfaction.md` แทนที่หัวข้อ `## API / Model` และ `## หมายเหตุ` ด้วย:

```markdown
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
การผูกเป็นแบบ first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้

## หมายเหตุ

โมดูลนี้อาจถูกใช้เป็นแหล่งคะแนนของ**ฟีดกิจกรรม** (roadmap เฟส 2) —
ตัดสินใจตอน brainstorm ว่าจะใช้ `Satisfaction` หรือ `StudentFeedback` ต่อกิจกรรม
```

- [ ] **Step 2: อัปเดต CLAUDE.md**

ใน `CLAUDE.md` หัวข้อ Feature modules แทนที่บรรทัดของ satisfaction ด้วย:

```markdown
- **User satisfaction / แบบประเมินความพึงพอใจ** — `pages/user/satisfaction.jsx`, `components/SatisfactionForm.js`, model `Satisfaction`. หน้า analysis สำหรับแอดมินที่ `/admin/feedback-analysis` · ให้คะแนนได้ 2 ช่องทาง: การ์ดหน้า `/status` (`source: 'public'`, 4 ครั้ง/เรื่อง) และปุ่มดาว postback ในการ์ด LINE (`source: 'line'`, 1 ครั้ง/เรื่องต่อ lineUserId) — **เขียน/อ่าน collection ผ่าน `lib/satisfaction/record.js` ที่เดียวเท่านั้น** อย่าเรียก `Satisfaction.create()` ตรง ๆ ที่อื่น
```

- [ ] **Step 3: commit**

```bash
git add docs/modules/satisfaction.md CLAUDE.md
git commit -m "docs: อัปเดตเอกสารโมดูล satisfaction (ช่องทาง LINE + record.js)"
```

---

## Task 11: ตรวจครบก่อนเปิด PR

**Files:** ไม่มีไฟล์ใหม่

- [ ] **Step 1: รันเทสทั้งชุด**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด

- [ ] **Step 2: typecheck**

รัน: `npx tsc --noEmit`
คาดหวัง: exit 0

- [ ] **Step 3: lint**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่

- [ ] **Step 4: build**

⚠️ ปิด `npm run dev` ก่อน แล้วลบ `.next` — รัน build ทับ dev server ทำให้ API ตอบ 500 แบบเงียบ

```bash
rm -rf .next && npm run build
```
คาดหวัง: build สำเร็จ ไม่มี error

- [ ] **Step 5: push + เปิด PR**

```bash
git push -u origin feat/line-satisfaction-rating
gh pr create --base main --head feat/line-satisfaction-rating \
  --title "feat(satisfaction): ให้คะแนนความพึงพอใจจากการ์ด LINE ได้เลย" \
  --body "ดูรายละเอียดใน docs/superpowers/specs/2026-08-17-line-satisfaction-rating-design.md"
```

---

## ทดสอบจริงหลัง merge (ทำมือ — repo ยังไม่มี integration test)

- [ ] ปิดงานเรื่องทดสอบที่มี `lineUserId` → การ์ดใน LINE ต้องมีแถบ ⭐1-5
- [ ] กดดาว → ต้องได้ข้อความขอบคุณ + มีแถวใหม่ใน `satisfactions` (`source: 'line'`, `lineUserId`, `rating`)
- [ ] พิมพ์ความเห็นตามทันที → ต้องได้ข้อความ "รับความเห็นแล้ว" และ `comment` เข้าแถวเดิม
- [ ] กดดาวซ้ำคนละคะแนน → ต้องได้ "อัปเดตเป็น ⭐⭐⭐ แล้วครับ" และ**ไม่มีแถวเพิ่ม**
- [ ] พิมพ์ `TKC-<เลขเรื่องที่ปิดแล้ว>` → การ์ดต้องมีแถบดาว (หรือ "ให้คะแนนไว้แล้ว" ถ้าเคยกด)
- [ ] พิมพ์เลขเรื่องอื่นหลังกดดาวไปแล้ว 1 นาที → ต้องได้**การ์ดสถานะ** ไม่ใช่ถูกเก็บเป็นความเห็น
- [ ] ในกลุ่มเจ้าหน้าที่ พิมพ์ `สถานะ TKC-xxxxxx` → การ์ดต้อง**ไม่มี**ปุ่มดาว
- [ ] เปิด `/admin/dashboard` → การ์ดความพึงพอใจแสดงบรรทัด "จากเจ้าของเรื่องผ่าน LINE n รายการ"
