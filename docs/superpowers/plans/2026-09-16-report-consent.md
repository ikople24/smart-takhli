# หน้าจอยินยอมก่อนแจ้งเรื่อง (report consent) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มขั้นข้อตกลง (ขั้นที่ 0) คั่นก่อน wizard แจ้งเรื่องใน `/report` แสดงครั้งแรกต่อเครื่อง พร้อมเก็บหลักฐานการยอมรับ 3 ชั้น

**Architecture:** `pages/report.tsx` มี state machine อยู่แล้ว (`step: 1 | 2 | 3 | "success"`) เพิ่มค่า `"checking"` (ยังไม่วาดอะไร ระหว่างอ่าน localStorage) และ `"consent"` (จอข้อตกลง) ไว้หน้าสุด · logic ล้วนทั้งหมด (parse ค่าที่เก็บไว้ / ตัดสินว่าจะโชว์ / ตรวจ body ของ log) อยู่ใน `lib/citizen/report/` มีเทสต์ vitest · ข้อความทุกบรรทัดอยู่ไฟล์เนื้อหาไฟล์เดียว · หลักฐานเก็บ 3 ชั้น: localStorage (ตัดสินว่าจะโชว์อีกไหม) · แนบไปกับเรื่องตอนส่ง · log collection `report_consent_logs`

**Tech Stack:** Next.js 15 Pages Router · React 19 · TypeScript (`allowJs: true`) · Tailwind v4 · Mongoose · vitest (node environment, logic ล้วน)

**Spec:** `docs/superpowers/specs/2026-09-16-report-consent-design.md`
**แบบอ้างอิง:** `docs/design_handoff_report_consent/หน้าจอยินยอมก่อนแจ้งเรื่อง.dc.html` (อาร์ตบอร์ด 1a)

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `lib/citizen/report/consentContent.js` | ข้อความทุกบรรทัด + `CONSENT_VERSION` + `KNOWN_CONSENT_VERSIONS` + เบอร์โทร (แก้ข้อความที่นี่ที่เดียว) |
| `lib/citizen/report/consent.js` | logic ล้วน: `parseStoredConsent` · `shouldShowConsent` · `validateConsentLog` |
| `lib/citizen/report/consentStorage.js` | อ่าน-เขียน localStorage หุ้ม try/catch + สุ่ม `deviceId` |
| `lib/citizen/report/payload.js` | (แก้) แนบ `consent` เข้า payload เดิมเฉพาะเมื่อมีค่าครบ |
| `components/citizen/report/ConsentScreen.tsx` | จอข้อตกลง: หัวจอ + เนื้อหา + ท้ายจอ sticky + ด่านเลื่อนอ่าน |
| `components/citizen/report/ConsentCancelSheet.tsx` | แผ่นยืนยันยกเลิกคำร้อง |
| `pages/report.tsx` | (แก้) เพิ่ม step `"checking"` / `"consent"` + ปลายทางหลังยอมรับ + แนบ consent ตอนส่ง |
| `pages/api/complaints/consent-log.ts` | ทางเขียน log (POST เท่านั้น ไม่มี GET) |
| `models/complaints/ReportConsentLog.js` | collection `report_consent_logs` + unique index `{deviceId, version}` |
| `models/Complaint.js` · `models/SubmittedReport.js` | (แก้) เพิ่มฟิลด์ `consent` ทั้งสองไฟล์ (schema ซ้ำสองไฟล์ ชื่อ model เดียวกัน) |
| `lib/citizen/__tests__/reportConsent.test.js` | เทสต์ logic ล้วนของโมดูลนี้ |
| `lib/citizen/__tests__/reportPayload.test.js` | (แก้) เพิ่มเคส consent |
| `docs/modules/complaints.md` | (แก้) บันทึกโมดูลย่อยนี้ |

**คำสั่งที่ใช้บ่อย**

- เทสต์เฉพาะไฟล์: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
- เทสต์ทั้งหมด: `npm test`
- ตรวจโค้ด: `npm run lint`

---

## Task 1: ไฟล์เนื้อหาข้อตกลง + เลขฉบับ

**Files:**
- Create: `lib/citizen/report/consentContent.js`
- Test: `lib/citizen/__tests__/reportConsent.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

สร้าง `lib/citizen/__tests__/reportConsent.test.js`:

```js
// lib/citizen/__tests__/reportConsent.test.js
import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  KNOWN_CONSENT_VERSIONS,
  CONSENT_SECTIONS,
  CONSENT_INTRO,
  EMERGENCY,
  CONSENT_CHECKBOX_LABEL,
} from "../report/consentContent";

describe("consentContent — เนื้อหาข้อตกลงฉบับปัจจุบัน", () => {
  it("เลขฉบับเป็นรูปแบบ x.y และอยู่ในรายชื่อฉบับที่ระบบรู้จัก", () => {
    expect(CONSENT_VERSION).toMatch(/^\d+\.\d+$/);
    expect(KNOWN_CONSENT_VERSIONS).toContain(CONSENT_VERSION);
  });

  it("มีครบ 4 หัวข้อ เรียงเลข 1-4 และมีชื่อหัวข้อทุกอัน", () => {
    expect(CONSENT_SECTIONS).toHaveLength(4);
    expect(CONSENT_SECTIONS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    for (const s of CONSENT_SECTIONS) {
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
    }
  });

  it("ทุก run ของทุกย่อหน้ามีข้อความจริง (กันพิมพ์ตกหล่น)", () => {
    for (const s of CONSENT_SECTIONS) {
      for (const para of s.paragraphs ?? []) {
        expect(para.length).toBeGreaterThan(0);
        for (const run of para) expect(typeof run.t).toBe("string");
      }
    }
  });

  it("การ์ดฉุกเฉินใช้เบอร์ 191 และมีบรรทัดงานจับสัตว์เลื้อยคลาน", () => {
    expect(EMERGENCY.phone).toBe("191");
    expect(EMERGENCY.animal.phone).toBe("056261500");
    expect(EMERGENCY.animal.label).toContain("สัตว์เลื้อยคลาน");
  });

  it("มีข้อความแนะนำระบบและข้อความข้างช่องติ๊ก", () => {
    expect(CONSENT_INTRO.title.length).toBeGreaterThan(0);
    expect(CONSENT_CHECKBOX_LABEL).toContain("ยอมรับ");
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: FAIL — `Failed to resolve import "../report/consentContent"`

- [ ] **Step 3: สร้างไฟล์เนื้อหา**

สร้าง `lib/citizen/report/consentContent.js` (ข้อความคัดจากอาร์ตบอร์ด 1a ตรงตัว):

```js
// lib/citizen/report/consentContent.js
// ข้อความทุกบรรทัดของจอข้อตกลงก่อนแจ้งเรื่อง + เลขฉบับ — แก้ข้อความที่ไฟล์นี้ที่เดียว
// ขยับ CONSENT_VERSION เมื่อไหร่ = คนที่เคยยอมรับฉบับเก่าจะเห็นจอนี้อีกครั้ง
// (อย่าลบเลขฉบับเก่าออกจาก KNOWN_CONSENT_VERSIONS — API log ใช้ตรวจ body)
//
// ⚠️ ข้อ 3 อ้างสถานะ "ตรวจสอบแล้วไม่พบเหตุ ณ เวลาปฏิบัติการ" / "บันทึกข้อมูลเพื่อเฝ้าระวัง"
// ซึ่งยังไม่มีใน lib/tasks/status.js — เจ้าของโปรเจกต์รับทราบแล้ว รอตัดสินใจตัด/ย่อภายหลัง

export const CONSENT_VERSION = "1.0";
export const KNOWN_CONSENT_VERSIONS = ["1.0"];

export const CONSENT_HEADER = {
  title: "ข้อตกลงและเงื่อนไขการใช้งาน",
  subtitle: "ก่อนเริ่มแจ้งเรื่อง · โปรดอ่านและกดยอมรับ",
  badge: "จำเป็น",
};

export const CONSENT_INTRO = {
  title: "ระบบรับแจ้งเรื่องร้องเรียนดิจิทัล",
  body: "เอกสารนี้อธิบายขอบเขตการให้บริการของช่องทางดิจิทัล ข้อยกเว้น และการปรับสถานะเรื่อง โปรดอ่านโดยละเอียดก่อนเริ่มใช้งาน",
};

export const EMERGENCY = {
  title: "เหตุฉุกเฉิน — อย่าแจ้งผ่านแอปฯ",
  body: "เหตุที่ต้องระงับภัยทันที ให้โทรแจ้งศูนย์รับแจ้งเหตุฉุกเฉิน หรือสถานีตำรวจในท้องที่โดยตรง เพื่อให้เจ้าหน้าที่เข้าปฏิบัติการได้ทันท่วงที",
  phone: "191",
  phoneNote: "โทรฟรีทุกเครือข่าย 24 ชม.",
  animal: {
    label: "งานจับสัตว์เลื้อยคลาน โทรงานป้องกันเทศบาลเมืองตาคลี",
    phone: "056261500",
  },
};

// paragraphs = ย่อหน้า[] · แต่ละย่อหน้า = run[] · run = { t: ข้อความ, b: ตัวหนา, danger: ตัวหนาสีแดง }
//
// ⚠️ ต้องมี @type ด้านล่าง ไม่งั้น TS จะ infer เป็น union ของ object literal คนละรูป
// แล้ว `section.chips` / `section.denyList` ใน ConsentScreen.tsx จะ error ตอน next build
/**
 * @typedef {{ t: string, b?: boolean, danger?: boolean }} ConsentRun
 * @typedef {{
 *   n: number,
 *   title: string,
 *   paragraphs?: ConsentRun[][],
 *   chips?: string[],
 *   denyList?: string[],
 *   statusChips?: string[],
 *   tailParagraph?: ConsentRun[],
 * }} ConsentSection
 */

/** @type {ConsentSection[]} */
export const CONSENT_SECTIONS = [
  {
    n: 1,
    title: "วัตถุประสงค์และขอบเขตการให้บริการ",
    paragraphs: [
      [
        { t: "ระบบรับแจ้งเรื่องร้องเรียนผ่านแอปพลิเคชันนี้ จัดทำขึ้นเพื่อเป็น" },
        { t: "ช่องทางเสริม", b: true },
        {
          t: "ในการอำนวยความสะดวกแก่ประชาชน สำหรับแจ้งข้อมูลเกี่ยวกับเหตุเดือดร้อนรำคาญ หรือความชำรุดเสียหายเชิงกายภาพและโครงสร้างพื้นฐานสาธารณะ ซึ่งเป็นเหตุต่อเนื่องที่ต้องอาศัยการเข้าตรวจสอบ วางแผน และดำเนินการแก้ไขทางกายภาพในวันและเวลาราชการ",
        },
      ],
    ],
    chips: ["ไฟส่องสว่างสาธารณะขัดข้อง", "ถนนชำรุด", "ท่อประปาแตก", "สิ่งก่อสร้างสาธารณะเสียหาย"],
  },
  {
    n: 2,
    title: "ข้อยกเว้นการให้บริการผ่านระบบดิจิทัล",
    paragraphs: [
      [
        { t: "ระบบนี้ " },
        { t: "ไม่รองรับ", b: true, danger: true },
        { t: " และไม่ได้ออกแบบมาเพื่อรับแจ้งเหตุในกรณีดังต่อไปนี้" },
      ],
    ],
    denyList: [
      "เหตุฉุกเฉินเฉพาะหน้า เหตุอันตรายร้ายแรง หรือเหตุที่ต้องการการเข้าระงับภัยในทันทีทันใด",
      "เหตุเดือดร้อนรำคาญจากพฤติกรรมชั่วคราวเฉพาะหน้า ซึ่งเกิดขึ้นและสิ้นสุดในระยะเวลาอันสั้น เช่น เสียงดังรบกวนยามวิกาล หรือการทะเลาะวิวาท",
      "ข้อพิพาทส่วนบุคคล หรือเรื่องที่ต้องอาศัยการตรวจพิสูจน์พยานหลักฐานซึ่งหน้า ณ ขณะเกิดเหตุ เพื่อการลงโทษตามกฎหมายเฉพาะ",
    ],
  },
  {
    n: 3,
    title: "เงื่อนไขการประมวลผลและการปรับสถานะเรื่อง",
    paragraphs: [
      [{ t: "การรับเรื่องผ่านระบบดิจิทัลจะตรวจสอบและประมวลผลตามลำดับความเร่งด่วนในวันและเวลาราชการ" }],
      [
        {
          t: "กรณีเจ้าหน้าที่เข้าตรวจสอบพื้นที่แล้วไม่พบเหตุ ณ ขณะเข้าดำเนินการ (เนื่องจากเหตุสิ้นสุดลงก่อนเจ้าหน้าที่เข้าถึง) หรือเป็นเรื่องที่ไม่อยู่ในขอบเขตตามข้อ 2 ระบบจะปรับสถานะเป็น",
        },
      ],
    ],
    statusChips: ["ตรวจสอบแล้วไม่พบเหตุ ณ เวลาปฏิบัติการ", "บันทึกข้อมูลเพื่อเฝ้าระวัง"],
    tailParagraph: [
      { t: "และบันทึกข้อมูลไว้ใช้เป็นสถิติในการเฝ้าระวังต่อไป การปรับสถานะดังกล่าวเป็นการดำเนินการทางเทคนิคของระบบ " },
      { t: "มิใช่การปฏิเสธการปฏิบัติหน้าที่ตามกฎหมายของหน่วยงาน", b: true },
    ],
  },
  {
    n: 4,
    title: "การจำกัดความรับผิดชอบ",
    paragraphs: [
      [
        {
          t: "เทศบาลขอสงวนสิทธิ์ในการไม่รับผิดชอบต่อความล่าช้าหรือความเสียหายใด ๆ ที่เกิดจากการเข้าใจผิดในวัตถุประสงค์ของระบบ โดยผู้ใช้บริการยอมรับว่าการแจ้งเรื่องผ่านระบบนี้ ",
        },
        { t: "ไม่ถือเป็นการทดแทนการแจ้งเหตุฉุกเฉินต่อเจ้าหน้าที่โดยตรง", b: true },
      ],
    ],
  },
];

export const CONSENT_UPDATED_LABEL = "ปรับปรุงล่าสุด 18 กันยายน 2569 · ฉบับที่ 1.0";
export const CONSENT_SCROLL_HINT = "เลื่อนอ่านให้ครบทุกข้อก่อนกดยอมรับ";
export const CONSENT_CHECKBOX_LABEL =
  "ข้าพเจ้าได้อ่านและยอมรับข้อตกลงและเงื่อนไขการใช้งาน รวมถึงรับทราบว่าระบบนี้ไม่รองรับการแจ้งเหตุฉุกเฉิน";
export const CONSENT_DECLINE_LABEL = "ไม่ยอมรับ";
export const CONSENT_ACCEPT_LABEL = "ยอมรับและเริ่มแจ้งเรื่อง";
export const CONSENT_FOOTER_NOTE = "ระบบจะบันทึกวันและเวลาที่ท่านกดยอมรับ เพื่อเป็นหลักฐานการรับทราบข้อตกลงฉบับนี้";

export const CANCEL_SHEET = {
  title: "ต้องการยกเลิกคำร้องใช่หรือไม่",
  body: "หากต้องการแจ้งเรื่องต่อ กรุณากลับไปกดยอมรับข้อตกลง หากยืนยันยกเลิก ระบบจะล้างข้อมูลที่เลือกไว้และพากลับหน้าแรก",
  backLabel: "กลับไปยอมรับ",
  confirmLabel: "ยืนยันยกเลิกคำร้อง",
};
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: PASS ทุกเทสต์ในไฟล์

- [ ] **Step 5: คอมมิต**

```bash
git add lib/citizen/report/consentContent.js lib/citizen/__tests__/reportConsent.test.js
git commit -m "feat(report): เนื้อหาข้อตกลงก่อนแจ้งเรื่อง + เลขฉบับ"
```

---

## Task 2: logic ตัดสินว่าจะแสดงจอข้อตกลงไหม

**Files:**
- Create: `lib/citizen/report/consent.js`
- Modify: `lib/citizen/__tests__/reportConsent.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

เพิ่มท้ายไฟล์ `lib/citizen/__tests__/reportConsent.test.js` และเพิ่ม import ด้านบนไฟล์:

```js
import { parseStoredConsent, shouldShowConsent } from "../report/consent";
```

```js
describe("parseStoredConsent — ค่าที่เก็บไว้ในเบราว์เซอร์", () => {
  const valid = JSON.stringify({
    version: "1.0",
    acceptedAt: "2026-09-16T02:31:00.000Z",
    deviceId: "3f1a5c22-1111-4222-8333-444455556666",
  });

  it("ค่าถูกต้อง → คืนอ็อบเจกต์ครบ 3 ฟิลด์", () => {
    expect(parseStoredConsent(valid)).toEqual({
      version: "1.0",
      acceptedAt: "2026-09-16T02:31:00.000Z",
      deviceId: "3f1a5c22-1111-4222-8333-444455556666",
    });
  });

  it("ไม่มีค่า / ค่าว่าง / ไม่ใช่สตริง → null", () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent("")).toBeNull();
    expect(parseStoredConsent(undefined)).toBeNull();
    expect(parseStoredConsent(42)).toBeNull();
  });

  it("JSON เสีย หรือไม่ใช่อ็อบเจกต์ → null (ไม่ throw)", () => {
    expect(parseStoredConsent("{ไม่ใช่ json")).toBeNull();
    expect(parseStoredConsent('"string ธรรมดา"')).toBeNull();
    expect(parseStoredConsent("null")).toBeNull();
  });

  it("ฟิลด์ไม่ครบหรือผิดชนิด → null", () => {
    expect(parseStoredConsent(JSON.stringify({ version: "1.0" }))).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ version: 1, acceptedAt: "x", deviceId: "y" }))).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ version: "1.0", acceptedAt: "x", deviceId: "" }))).toBeNull();
  });
});

describe("shouldShowConsent — ต้องโชว์จอข้อตกลงไหม", () => {
  it("ไม่เคยยอมรับ → ต้องโชว์", () => {
    expect(shouldShowConsent(null)).toBe(true);
  });

  it("เคยยอมรับฉบับปัจจุบัน → ไม่ต้องโชว์", () => {
    expect(shouldShowConsent({ version: CONSENT_VERSION, acceptedAt: "x", deviceId: "y" })).toBe(false);
  });

  it("เคยยอมรับคนละฉบับ → ต้องโชว์อีกครั้ง", () => {
    expect(shouldShowConsent({ version: "0.9", acceptedAt: "x", deviceId: "y" })).toBe(true);
  });

  it("ระบุฉบับปัจจุบันเองได้ (เผื่อเทสต์/อนาคต)", () => {
    expect(shouldShowConsent({ version: "2.0", acceptedAt: "x", deviceId: "y" }, "2.0")).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: FAIL — `Failed to resolve import "../report/consent"`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

สร้าง `lib/citizen/report/consent.js`:

```js
// lib/citizen/report/consent.js
// logic ล้วนของขั้นข้อตกลงก่อนแจ้งเรื่อง — ไม่แตะ DOM/localStorage/เครือข่าย
// (ตัวห่อ localStorage อยู่ consentStorage.js · เนื้อหา/เลขฉบับอยู่ consentContent.js)
import { CONSENT_VERSION, KNOWN_CONSENT_VERSIONS } from "./consentContent";

/**
 * แปลงค่าดิบจาก localStorage เป็นอ็อบเจกต์ — ค่าพังทุกแบบคืน null (ไม่ throw)
 * @param {unknown} raw
 * @returns {{ version: string, acceptedAt: string, deviceId: string } | null}
 */
export function parseStoredConsent(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { version, acceptedAt, deviceId } = value;
    if (typeof version !== "string" || version === "") return null;
    if (typeof acceptedAt !== "string" || acceptedAt === "") return null;
    if (typeof deviceId !== "string" || deviceId === "") return null;
    return { version, acceptedAt, deviceId };
  } catch {
    return null;
  }
}

/**
 * ต้องแสดงจอข้อตกลงไหม — ยอมรับคนละฉบับถือว่ายังไม่ยอมรับ
 * @param {{ version: string } | null} stored
 * @param {string} [currentVersion]
 */
export function shouldShowConsent(stored, currentVersion = CONSENT_VERSION) {
  if (!stored) return true;
  return stored.version !== currentVersion;
}

export { CONSENT_VERSION, KNOWN_CONSENT_VERSIONS };
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: PASS ทุกเทสต์ในไฟล์

- [ ] **Step 5: คอมมิต**

```bash
git add lib/citizen/report/consent.js lib/citizen/__tests__/reportConsent.test.js
git commit -m "feat(report): logic ตัดสินว่าจะแสดงจอข้อตกลงไหม"
```

---

## Task 3: ตัวตรวจ body ของ log ฝั่งเซิร์ฟเวอร์

**Files:**
- Modify: `lib/citizen/report/consent.js`
- Modify: `lib/citizen/__tests__/reportConsent.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

แก้ import ด้านบนไฟล์เทสต์เป็น:

```js
import { parseStoredConsent, shouldShowConsent, validateConsentLog } from "../report/consent";
```

เพิ่มท้ายไฟล์:

```js
describe("validateConsentLog — ตรวจ body ก่อนเขียน log (ทางเขียนสาธารณะ)", () => {
  const now = new Date("2026-09-16T03:00:00.000Z");
  const okBody = {
    version: "1.0",
    acceptedAt: "2026-09-16T02:31:00.000Z",
    deviceId: "3f1a5c22-1111-4222-8333-444455556666",
  };

  it("body ถูกต้อง → ok และแปลง acceptedAt เป็น Date", () => {
    const r = validateConsentLog(okBody, now);
    expect(r.ok).toBe(true);
    expect(r.value.version).toBe("1.0");
    expect(r.value.deviceId).toBe(okBody.deviceId);
    expect(r.value.acceptedAt).toBeInstanceOf(Date);
    expect(r.value.acceptedAt.toISOString()).toBe("2026-09-16T02:31:00.000Z");
  });

  it("ไม่ใช่อ็อบเจกต์ → ไม่ ok และ value เป็น null", () => {
    expect(validateConsentLog(null, now).ok).toBe(false);
    expect(validateConsentLog(null, now).value).toBeNull();
    expect(validateConsentLog("x", now).ok).toBe(false);
  });

  it("เลขฉบับที่ระบบไม่รู้จัก → ไม่ ok", () => {
    const r = validateConsentLog({ ...okBody, version: "9.9" }, now);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ฉบับ");
  });

  it("deviceId ผิดรูป (สั้นไป / มีอักขระแปลก) → ไม่ ok", () => {
    expect(validateConsentLog({ ...okBody, deviceId: "abc" }, now).ok).toBe(false);
    expect(validateConsentLog({ ...okBody, deviceId: "a".repeat(65) }, now).ok).toBe(false);
    expect(validateConsentLog({ ...okBody, deviceId: "bad id!!" }, now).ok).toBe(false);
  });

  it("acceptedAt ใช้ไม่ได้หรือเพี้ยนเกิน 2 วัน → ใช้เวลาเซิร์ฟเวอร์แทน แต่ยัง ok", () => {
    for (const bad of ["ไม่ใช่เวลา", "2030-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", undefined]) {
      const r = validateConsentLog({ ...okBody, acceptedAt: bad }, now);
      expect(r.ok).toBe(true);
      expect(r.value.acceptedAt.toISOString()).toBe(now.toISOString());
    }
  });

  it("ฟิลด์เกินใน body ถูกทิ้ง ไม่หลุดลง DB", () => {
    const r = validateConsentLog({ ...okBody, lineUserId: "U123", fullName: "สมชาย" }, now);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.value).sort()).toEqual(["acceptedAt", "deviceId", "version"]);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: FAIL — `validateConsentLog is not a function`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

เพิ่มท้าย `lib/citizen/report/consent.js` (ก่อนบรรทัด `export { CONSENT_VERSION, ... }`):

```js
/** รหัสอุปกรณ์ที่ยอมรับ — uuid v4 หรือสตริงสำรองที่ออกโดย consentStorage.js */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** เวลาที่ client ส่งมาห่างจากเวลาเซิร์ฟเวอร์ได้ไม่เกิน 2 วัน (กันนาฬิกาเครื่องเพี้ยน/ยิงมั่ว) */
export const ACCEPTED_AT_MAX_SKEW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * ตรวจ body ของ POST /api/complaints/consent-log — เก็บเฉพาะ 3 ฟิลด์ที่ต้องใช้ ทิ้งที่เหลือทั้งหมด
 *
 * คืน "รูปเดียวเสมอ" (ok + error + value) แทน union เพราะฝั่งที่เรียกเป็นไฟล์ .ts
 * การพึ่ง narrowing จาก JSDoc union ทำให้ next build พังง่ายเวลา TS infer ไม่ตรง
 *
 * @param {unknown} body
 * @param {Date} [now]
 * @returns {{ ok: boolean, error: string | null, value: { version: string, acceptedAt: Date, deviceId: string } | null }}
 */
export function validateConsentLog(body, now = new Date()) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง", value: null };
  }
  const { version, acceptedAt, deviceId } = body;

  if (typeof version !== "string" || !KNOWN_CONSENT_VERSIONS.includes(version)) {
    return { ok: false, error: "เลขฉบับข้อตกลงไม่ถูกต้อง", value: null };
  }
  if (typeof deviceId !== "string" || !DEVICE_ID_PATTERN.test(deviceId)) {
    return { ok: false, error: "รหัสอุปกรณ์ไม่ถูกต้อง", value: null };
  }

  // เวลาที่ใช้ไม่ได้ไม่ถือเป็น error — หลักฐานยังมีค่า แค่ใช้เวลาเซิร์ฟเวอร์แทน
  let when = typeof acceptedAt === "string" ? new Date(acceptedAt) : new Date(NaN);
  if (Number.isNaN(when.getTime()) || Math.abs(when.getTime() - now.getTime()) > ACCEPTED_AT_MAX_SKEW_MS) {
    when = new Date(now.getTime());
  }

  return { ok: true, error: null, value: { version, acceptedAt: when, deviceId } };
}
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: PASS ทุกเทสต์ในไฟล์

- [ ] **Step 5: คอมมิต**

```bash
git add lib/citizen/report/consent.js lib/citizen/__tests__/reportConsent.test.js
git commit -m "feat(report): ตัวตรวจ body ของ consent log ฝั่งเซิร์ฟเวอร์"
```

---

## Task 4: ตัวห่อ localStorage + รหัสอุปกรณ์

**Files:**
- Create: `lib/citizen/report/consentStorage.js`
- Modify: `lib/citizen/__tests__/reportConsent.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

เพิ่ม import ด้านบนไฟล์เทสต์:

```js
import {
  CONSENT_STORAGE_KEY,
  newDeviceId,
  readConsent,
  writeConsent,
} from "../report/consentStorage";
import { DEVICE_ID_PATTERN } from "../report/consent";
```

เพิ่มท้ายไฟล์:

```js
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    dump: () => data,
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("localStorage ถูกปิด");
  },
  setItem() {
    throw new Error("localStorage ถูกปิด");
  },
};

describe("consentStorage — อ่านเขียนค่าในเครื่องแบบไม่ทำให้หน้าพัง", () => {
  it("newDeviceId ได้ค่าที่ผ่านเกณฑ์ของฝั่งเซิร์ฟเวอร์ และไม่ซ้ำกัน", () => {
    const a = newDeviceId();
    const b = newDeviceId();
    expect(a).toMatch(DEVICE_ID_PATTERN);
    expect(b).toMatch(DEVICE_ID_PATTERN);
    expect(a).not.toBe(b);
  });

  it("writeConsent เขียนลง storage แล้ว readConsent อ่านกลับได้", () => {
    const storage = fakeStorage();
    const written = writeConsent({}, storage);
    expect(written.version).toBe(CONSENT_VERSION);
    expect(written.deviceId).toMatch(DEVICE_ID_PATTERN);
    expect(new Date(written.acceptedAt).toString()).not.toBe("Invalid Date");
    expect(JSON.parse(storage.dump()[CONSENT_STORAGE_KEY])).toEqual(written);
    expect(readConsent(storage)).toEqual(written);
  });

  it("writeConsent ใช้ deviceId เดิมได้ถ้าส่งเข้ามา (ยอมรับซ้ำไม่สร้างรหัสใหม่)", () => {
    const storage = fakeStorage();
    const first = writeConsent({}, storage);
    const second = writeConsent({ deviceId: first.deviceId }, storage);
    expect(second.deviceId).toBe(first.deviceId);
  });

  it("ไม่มี storage (โหมดส่วนตัว) → readConsent คืน null · writeConsent ยังคืนค่าให้ใช้ต่อ", () => {
    expect(readConsent(null)).toBeNull();
    const written = writeConsent({}, null);
    expect(written.deviceId).toMatch(DEVICE_ID_PATTERN);
  });

  it("storage ที่ throw → ไม่ทำให้พัง", () => {
    expect(readConsent(throwingStorage)).toBeNull();
    expect(() => writeConsent({}, throwingStorage)).not.toThrow();
  });

  it("ค่าในเครื่องพัง → readConsent คืน null", () => {
    const storage = fakeStorage({ [CONSENT_STORAGE_KEY]: "{พัง" });
    expect(readConsent(storage)).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: FAIL — `Failed to resolve import "../report/consentStorage"`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

สร้าง `lib/citizen/report/consentStorage.js`:

```js
// lib/citizen/report/consentStorage.js
// ตัวห่อ localStorage ของขั้นข้อตกลง — ทุกทางเข้าออกหุ้ม try/catch
// เบราว์เซอร์โหมดส่วนตัว/ปิด storage จะเห็นจอข้อตกลงทุกครั้ง แต่ต้องแจ้งเรื่องต่อได้ตามปกติ
import { CONSENT_VERSION } from "./consentContent";
import { parseStoredConsent } from "./consent";

export const CONSENT_STORAGE_KEY = "tk.report.consent";

/** คืน localStorage ถ้าใช้ได้จริง ไม่งั้นคืน null (SSR หรือเบราว์เซอร์ที่บล็อก) */
export function getStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** รหัสอุปกรณ์แบบสุ่ม ไม่ผูกกับตัวบุคคล ใช้กันแถว log ซ้ำเท่านั้น */
export function newDeviceId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ตกไปใช้ค่าสำรองด้านล่าง
  }
  return `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * @param {Storage | null} [storage]
 * @returns {{ version: string, acceptedAt: string, deviceId: string } | null}
 */
export function readConsent(storage = getStorage()) {
  if (!storage) return null;
  try {
    return parseStoredConsent(storage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * บันทึกการยอมรับลงเครื่อง แล้วคืนค่าที่บันทึก (ใช้ต่อได้แม้เขียนไม่สำเร็จ)
 * @param {{ version?: string, acceptedAt?: string, deviceId?: string }} [input]
 * @param {Storage | null} [storage]
 */
export function writeConsent(input = {}, storage = getStorage()) {
  const value = {
    version: input.version ?? CONSENT_VERSION,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    deviceId: input.deviceId || newDeviceId(),
  };
  if (storage) {
    try {
      storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // เขียนไม่ได้ก็ปล่อย — ผู้ใช้จะเห็นจอข้อตกลงอีกครั้งหน้า แต่แจ้งเรื่องรอบนี้ได้ปกติ
    }
  }
  return value;
}
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

รัน: `npx vitest run lib/citizen/__tests__/reportConsent.test.js`
คาดหวัง: PASS ทุกเทสต์ในไฟล์

- [ ] **Step 5: คอมมิต**

```bash
git add lib/citizen/report/consentStorage.js lib/citizen/__tests__/reportConsent.test.js
git commit -m "feat(report): ตัวห่อ localStorage ของขั้นข้อตกลง"
```

---

## Task 5: แนบหลักฐานการยอมรับเข้า payload ตอนส่งเรื่อง

**Files:**
- Modify: `lib/citizen/report/payload.js`
- Modify: `lib/citizen/__tests__/reportPayload.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

เพิ่มท้าย `lib/citizen/__tests__/reportPayload.test.js`:

```js
describe("buildComplaintPayload — หลักฐานการยอมรับข้อตกลง", () => {
  const consent = { version: "1.0", acceptedAt: "2026-09-16T02:31:00.000Z" };

  it("ไม่มีข้อมูลยินยอม → payload เหมือนเดิมทุกคีย์ (ไม่มีคีย์ consent)", () => {
    const p = buildComplaintPayload(state, problemOptions);
    expect(Object.keys(p)).not.toContain("consent");
  });

  it("มีข้อมูลยินยอมครบ → แนบเฉพาะ version กับ acceptedAt", () => {
    const p = buildComplaintPayload({ ...state, consent }, problemOptions);
    expect(p.consent).toEqual(consent);
  });

  it("ไม่ส่ง deviceId ขึ้นไปกับเรื่อง", () => {
    const p = buildComplaintPayload(
      { ...state, consent: { ...consent, deviceId: "3f1a5c22-1111-4222-8333-444455556666" } },
      problemOptions
    );
    expect(Object.keys(p.consent).sort()).toEqual(["acceptedAt", "version"]);
  });

  it("ข้อมูลยินยอมไม่ครบ → ไม่แนบคีย์ consent", () => {
    expect(buildComplaintPayload({ ...state, consent: { version: "1.0" } }, problemOptions).consent).toBeUndefined();
    expect(buildComplaintPayload({ ...state, consent: null }, problemOptions).consent).toBeUndefined();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

รัน: `npx vitest run lib/citizen/__tests__/reportPayload.test.js`
คาดหวัง: FAIL 2 เทสต์ (`p.consent` เป็น undefined ทั้งที่ควรมีค่า)

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

แก้ `lib/citizen/report/payload.js` — เปลี่ยน `return { ... }` เป็นการสร้างตัวแปรแล้วเติม `consent` ท้ายสุด:

```js
// lib/citizen/report/payload.js
// payload สำหรับ POST /api/submittedreports/submit-report — shape ต้องตรง
// ComplaintFormModal.js:119-135 (ฟอร์มเดิม) ทุก field ห้ามแก้ฝั่งเดียว
// หมายเหตุ: ฟอร์มเดิมส่งค่าดิบ (ไม่ trim) — คงพฤติกรรมเดิมไว้
// consent: แนบเฉพาะเมื่อมีครบทั้ง version และ acceptedAt — ไม่มีก็ไม่ใส่คีย์
// (เรื่องที่ไม่มีข้อมูลยินยอมต้องได้ payload เหมือนเดิมทุกไบต์)
export function buildComplaintPayload(state, problemOptions) {
  const payload = {
    prefix: state.prefix,
    fullName: state.fullName,
    phone: state.phone,
    community: state.community,
    problems: state.selectedProblems.map((id) => {
      const match = problemOptions.find((opt) => opt._id === id);
      return match ? match.label : id;
    }),
    category: state.category,
    images: state.imageUrls,
    detail: state.detail,
    location: state.location,
    status: "อยู่ระหว่างดำเนินการ",
    officer: "",
    updatedAt: new Date(),
  };

  if (state.consent?.version && state.consent?.acceptedAt) {
    payload.consent = {
      version: state.consent.version,
      acceptedAt: state.consent.acceptedAt,
    };
  }

  return payload;
}
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

รัน: `npx vitest run lib/citizen/__tests__/reportPayload.test.js`
คาดหวัง: PASS ทั้งหมด — เทสต์เดิมที่เช็กรายชื่อคีย์ต้องยังเขียว เพราะเคสนั้นไม่มี consent

- [ ] **Step 5: คอมมิต**

```bash
git add lib/citizen/report/payload.js lib/citizen/__tests__/reportPayload.test.js
git commit -m "feat(report): แนบหลักฐานการยอมรับเข้า payload ตอนส่งเรื่อง"
```

---

## Task 6: ฟิลด์ consent ใน model เรื่องร้องเรียน (สองไฟล์)

**Files:**
- Modify: `models/Complaint.js`
- Modify: `models/SubmittedReport.js`

> ⚠️ ทั้งสองไฟล์ลงทะเบียน model ชื่อ `SubmittedReport` เหมือนกัน ถ้าแก้ไฟล์เดียวฟิลด์จะหายเงียบ ๆ
> ตอนที่ handler อีกตัวถูกโหลดก่อน — ต้องแก้ครบทั้งคู่เสมอ

- [ ] **Step 1: เพิ่ม sub-schema ใน `models/Complaint.js`**

เติมใต้บรรทัด `import mongoose from 'mongoose';`:

```js
/** หลักฐานการยอมรับข้อตกลงก่อนแจ้งเรื่อง (จอ consent บน /report)
 *  ห่อเป็น sub-schema ปิด _id — ถ้าใส่เป็น plain object mongoose จะแถม _id ให้ทุกเอกสาร
 *  ⚠️ ต้องมีเหมือนกันใน models/SubmittedReport.js (schema ซ้ำสองไฟล์ ชื่อ model เดียวกัน) */
const ConsentSchema = new mongoose.Schema(
  {
    version: { type: String, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { _id: false }
);
```

แล้วเพิ่มฟิลด์ต่อจาก `pdpaDetailRedactions` (ก่อน `updatedAt`):

```js
  consent: { type: ConsentSchema, default: undefined },
```

- [ ] **Step 2: เพิ่มฟิลด์เดียวกันใน `models/SubmittedReport.js`**

เติม sub-schema เดียวกันใต้ `import mongoose from 'mongoose';`:

```js
/** หลักฐานการยอมรับข้อตกลงก่อนแจ้งเรื่อง — ต้องตรงกับ models/Complaint.js */
const ConsentSchema = new mongoose.Schema(
  {
    version: { type: String, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { _id: false }
);
```

แล้วเพิ่มฟิลด์ต่อจาก `pdpaDetailRedactions` (ก่อน `updatedAt`):

```js
  consent: { type: ConsentSchema, default: undefined },
```

- [ ] **Step 3: ตรวจว่าแก้ครบทั้งสองไฟล์**

รัน: `grep -c "ConsentSchema" models/Complaint.js models/SubmittedReport.js`
คาดหวัง: ได้ `2` ทั้งสองไฟล์ (ประกาศ 1 + ใช้งาน 1)

- [ ] **Step 4: ตรวจโค้ด**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่จากสองไฟล์นี้

- [ ] **Step 5: คอมมิต**

```bash
git add models/Complaint.js models/SubmittedReport.js
git commit -m "feat(complaints): ฟิลด์ consent ในเอกสารเรื่องร้องเรียน (ทั้งสอง schema)"
```

---

## Task 7: collection log + ทางเขียนสาธารณะ

**Files:**
- Create: `models/complaints/ReportConsentLog.js`
- Create: `pages/api/complaints/consent-log.ts`

- [ ] **Step 1: สร้าง model**

สร้าง `models/complaints/ReportConsentLog.js`:

```js
import mongoose from "mongoose";

// หลักฐานการกดยอมรับข้อตกลงก่อนแจ้งเรื่อง — เขียนทันทีที่ผู้ใช้กดยอมรับ
// (อีกชั้นคือฟิลด์ consent บนตัวเรื่องเอง ดู models/Complaint.js)
//
// ⚠️ เขียนได้โดยไม่ต้องล็อกอิน (ผู้แจ้งไม่มีบัญชี) จึงเก็บให้น้อยที่สุด:
// ไม่เก็บ IP ไม่เก็บ user-agent ไม่เก็บชื่อ/เบอร์ และไม่มีทางอ่านฝั่งสาธารณะ
const ReportConsentLogSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
    /** รหัสสุ่มจากเบราว์เซอร์ ไม่ผูกกับตัวบุคคล ใช้กันแถวซ้ำ */
    deviceId: { type: String, required: true },
    appId: { type: String, default: "" },
  },
  { collection: "report_consent_logs", timestamps: true }
);

// 1 อุปกรณ์ + 1 ฉบับ = 1 แถว — ยิงซ้ำกี่ครั้งก็ upsert ทับตัวเดิม
ReportConsentLogSchema.index({ deviceId: 1, version: 1 }, { unique: true });

export default mongoose.models.ReportConsentLog ||
  mongoose.model("ReportConsentLog", ReportConsentLogSchema);
```

- [ ] **Step 2: สร้าง API route**

สร้าง `pages/api/complaints/consent-log.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import ReportConsentLog from "@/models/complaints/ReportConsentLog";
import { validateConsentLog } from "@/lib/citizen/report/consent";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

/**
 * บันทึกหลักฐานการกดยอมรับข้อตกลงก่อนแจ้งเรื่อง (จอ consent บน /report)
 *
 * ทางเขียนสาธารณะ ไม่ผ่าน Clerk เพราะผู้แจ้งไม่มีบัญชี — กันความเสียหายด้วยการ
 * เก็บน้อยที่สุด ตรวจ body เข้ม upsert ทับตัวเดิม และไม่มี GET ให้อ่านกลับ
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }

  // header เดียวกับที่ฟอร์มส่งเรื่องใช้ — กันคำขอที่ไม่ได้มาจากแอปนี้ระดับพื้นฐาน
  if (APP_ID && req.headers["x-app-id"] !== APP_ID) {
    return res.status(400).json({ error: "คำขอไม่ถูกต้อง" });
  }

  const parsed = validateConsentLog(req.body);
  if (!parsed.ok || !parsed.value) {
    return res.status(400).json({ error: parsed.error ?? "คำขอไม่ถูกต้อง" });
  }

  const { version, acceptedAt, deviceId } = parsed.value;

  try {
    await dbConnect();
    await ReportConsentLog.updateOne(
      { deviceId, version },
      { $set: { acceptedAt }, $setOnInsert: { deviceId, version, appId: APP_ID } },
      { upsert: true }
    );
    return res.status(204).end();
  } catch (err) {
    console.error("[complaints/consent-log]", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
```

- [ ] **Step 3: ตรวจว่าไม่ชนกับ route เดิม**

รัน: `ls pages/api/complaints`
คาดหวัง: เห็น `consent-log.ts` อยู่ข้าง `[id_card].js` โดยไม่มีโฟลเดอร์ dynamic ใหม่
(โปรเจกต์นี้เคยเจอ dev server ล้มทั้งตัวจาก dynamic slug ชนกัน — ไฟล์นี้เป็น static path จึงปลอดภัย)

- [ ] **Step 4: ตรวจโค้ด**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่

- [ ] **Step 5: smoke test ยิงจริง 1 แถว แล้วลบทิ้ง**

> เครื่อง dev ต่อฐานข้อมูลจริง — ใช้ `deviceId` ที่ขึ้นต้นด้วย `smoke-test-` แล้วลบทันทีหลังตรวจ

เปิด dev server พอร์ต 3100 (พอร์ตอื่นเพื่อไม่ชนของเจ้าของ) แล้วรอจน compile เสร็จ:

```bash
PORT=3100 npm run dev
```

อีกเทอร์มินัลหนึ่ง:

```bash
APP_ID=$(grep '^NEXT_PUBLIC_APP_ID=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3100/api/complaints/consent-log \
  -H 'content-type: application/json' -H "x-app-id: $APP_ID" \
  -d '{"version":"1.0","acceptedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","deviceId":"smoke-test-0000-1111"}'
```

คาดหวัง: `204`

ยิงซ้ำคำสั่งเดิมอีกครั้ง คาดหวัง `204` เหมือนเดิม (upsert ไม่สร้างแถวใหม่)

ทดสอบ body ที่ผิด คาดหวัง `400`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3100/api/complaints/consent-log \
  -H 'content-type: application/json' -H "x-app-id: $APP_ID" \
  -d '{"version":"9.9","acceptedAt":"2026-09-16T00:00:00.000Z","deviceId":"smoke-test-0000-1111"}'
```

ทดสอบ GET คาดหวัง `405`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/api/complaints/consent-log
```

ลบแถวทดสอบแล้วนับแถวที่เหลือ:

```bash
node --env-file=.env.local --input-type=module -e "
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URI);
const col = mongoose.connection.collection('report_consent_logs');
console.log('ลบ', (await col.deleteMany({ deviceId: /^smoke-test-/ })).deletedCount, 'แถว');
console.log('เหลือ', await col.countDocuments(), 'แถว');
await mongoose.disconnect();
"
```

คาดหวัง: `ลบ 1 แถว` และ `เหลือ 0 แถว`

**ปิด dev server ให้เรียบร้อย** (Ctrl+C ที่เทอร์มินัลแรก) — ห้ามทิ้งค้างไว้ใน working copy ของเจ้าของ

- [ ] **Step 6: คอมมิต**

```bash
git add models/complaints/ReportConsentLog.js pages/api/complaints/consent-log.ts
git commit -m "feat(complaints): collection report_consent_logs + ทางเขียน consent log"
```

---

## Task 8: แผ่นยืนยันยกเลิกคำร้อง

**Files:**
- Create: `components/citizen/report/ConsentCancelSheet.tsx`

- [ ] **Step 1: สร้างคอมโพเนนต์**

```tsx
// components/citizen/report/ConsentCancelSheet.tsx
// แผ่นยืนยันตอนผู้ใช้กด "ไม่ยอมรับ" ในจอข้อตกลง (สไตล์ bottom sheet ตามอาร์ตบอร์ด 1b)
// onBack = กลับไปหน้าข้อตกลง · onConfirm = ยืนยันยกเลิก (ล้างฟอร์ม + กลับหน้าแรก)
import { CANCEL_SHEET } from "@/lib/citizen/report/consentContent";

export default function ConsentCancelSheet({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onBack}
        className="absolute inset-0 bg-[rgba(27,24,48,0.45)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[480px] rounded-t-[22px] bg-white px-[18px] pb-7 pt-2.5 shadow-[0_-12px_40px_rgba(27,24,48,0.22)]"
      >
        <div className="mx-auto mb-3.5 h-1 w-[42px] rounded-full bg-[#E4DEF2]" />
        <div className="text-[17px] font-bold text-[#1B1830]">{CANCEL_SHEET.title}</div>
        <p className="mt-1.5 text-[12.5px] leading-[1.7] text-[#6B6880]">{CANCEL_SHEET.body}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
        >
          {CANCEL_SHEET.backLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-2 w-full rounded-[15px] bg-[#DC2626] py-3.5 text-[15px] font-semibold text-white"
        >
          {CANCEL_SHEET.confirmLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ตรวจโค้ด**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่

- [ ] **Step 3: คอมมิต**

```bash
git add components/citizen/report/ConsentCancelSheet.tsx
git commit -m "feat(report): แผ่นยืนยันยกเลิกคำร้องในจอข้อตกลง"
```

---

## Task 9: จอข้อตกลง

**Files:**
- Create: `components/citizen/report/ConsentScreen.tsx`

- [ ] **Step 1: สร้างคอมโพเนนต์**

```tsx
// components/citizen/report/ConsentScreen.tsx
// จอข้อตกลงก่อนเริ่ม wizard แจ้งเรื่อง (อาร์ตบอร์ด 1a)
// - ติ๊กยอมรับไม่ได้จนกว่าจะเลื่อนอ่านถึงท้ายหน้า (เนื้อหาสั้นกว่าจอ = ถือว่าครบทันที)
// - ปุ่ม "ไม่ยอมรับ" เปิดแผ่นยืนยันยกเลิก
// - ข้อความทุกบรรทัดมาจาก lib/citizen/report/consentContent.js (แก้ที่นั่นที่เดียว)
import { useEffect, useState } from "react";
import ConsentCancelSheet from "./ConsentCancelSheet";
import {
  CONSENT_ACCEPT_LABEL,
  CONSENT_CHECKBOX_LABEL,
  CONSENT_DECLINE_LABEL,
  CONSENT_FOOTER_NOTE,
  CONSENT_HEADER,
  CONSENT_INTRO,
  CONSENT_SCROLL_HINT,
  CONSENT_SECTIONS,
  CONSENT_UPDATED_LABEL,
  EMERGENCY,
} from "@/lib/citizen/report/consentContent";

type Run = { t: string; b?: boolean; danger?: boolean };

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.b ? (
          <b key={i} className={`font-semibold ${run.danger ? "text-[#B91C1C]" : "text-[#4A4458]"}`}>
            {run.t}
          </b>
        ) : (
          <span key={i}>{run.t}</span>
        )
      )}
    </>
  );
}

function DenyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#DC2626"
      strokeWidth={2.4}
      strokeLinecap="round"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

export default function ConsentScreen({
  onAccept,
  onExit,
  onCancel,
}: {
  onAccept: () => void;
  onExit: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ด่านเลื่อนอ่าน: ใช้ scroll ของทั้งหน้า (หน้าฝั่งประชาชนเลื่อนทั้งหน้า ไม่ใช่กล่องใน)
  useEffect(() => {
    const check = () => {
      const doc = document.documentElement;
      const done = window.innerHeight + window.scrollY >= doc.scrollHeight - 24;
      setAtEnd((prev) => (prev === done ? prev : done));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="shrink-0 px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="ย้อนกลับ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold leading-tight">{CONSENT_HEADER.title}</div>
            <div className="mt-0.5 text-[11px] text-[#9590A8]">{CONSENT_HEADER.subtitle}</div>
          </div>
          <span className="shrink-0 rounded-[8px] bg-[#F1ECFE] px-2.5 py-1.5 text-[10px] font-semibold text-[#7C3AED]">
            {CONSENT_HEADER.badge}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-5">
        <div className="flex items-start gap-3 rounded-[16px] bg-white p-3.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F1ECFE]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 15h6" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold">{CONSENT_INTRO.title}</div>
            <p className="mt-1 text-[12px] leading-[1.7] text-[#6B6880]">{CONSENT_INTRO.body}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[16px] border border-[#FBD5D5] bg-[#FFF5F5] p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FEE2E2]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-[#B91C1C]">{EMERGENCY.title}</div>
            <p className="mt-1 text-[12px] leading-[1.7] text-[#7F1D1D]">{EMERGENCY.body}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${EMERGENCY.phone}`}
                className="flex items-center gap-1.5 rounded-[11px] bg-[#DC2626] px-3 py-2 text-[12px] font-semibold text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.27a2 2 0 0 1 2.11-.45c.83.34 1.71.57 2.61.7A2 2 0 0 1 22 16.92Z" />
                </svg>
                {EMERGENCY.phone}
              </a>
              <span className="text-[11px] text-[#9F5B5B]">{EMERGENCY.phoneNote}</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.6] text-[#7F1D1D]">
              {EMERGENCY.animal.label}{" "}
              <a href={`tel:${EMERGENCY.animal.phone}`} className="font-semibold underline">
                {EMERGENCY.animal.phone}
              </a>
            </p>
          </div>
        </div>

        {CONSENT_SECTIONS.map((section) => (
          <div key={section.n} className="rounded-[16px] bg-white p-4 shadow-[0_4px_12px_rgba(60,40,100,0.04)]">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-[#7C3AED]">{section.n}.</span>
              <div className="text-[13px] font-bold">{section.title}</div>
            </div>

            {section.paragraphs?.map((runs: Run[], i: number) => (
              <p key={i} className="mt-2 text-[12px] leading-[1.85] text-[#6B6880]">
                <Runs runs={runs} />
              </p>
            ))}

            {section.chips && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {section.chips.map((chip: string) => (
                  <span key={chip} className="rounded-[9px] bg-[#F4F0FE] px-2.5 py-1.5 text-[11px] text-[#7C3AED]">
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {section.denyList && (
              <div className="mt-3 flex flex-col gap-2.5">
                {section.denyList.map((item: string) => (
                  <div key={item} className="flex items-start gap-2.5 rounded-[12px] bg-[#FAF9FC] px-3 py-2.5">
                    <DenyIcon />
                    <div className="text-[12px] leading-[1.7] text-[#4A4458]">{item}</div>
                  </div>
                ))}
              </div>
            )}

            {section.statusChips && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {section.statusChips.map((chip: string) => (
                  <span
                    key={chip}
                    className="self-start rounded-[10px] border border-dashed border-[#C9BCEC] bg-[#F1ECFE] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#3F3B52]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {section.tailParagraph && (
              <p className="mt-2.5 text-[12px] leading-[1.85] text-[#6B6880]">
                <Runs runs={section.tailParagraph} />
              </p>
            )}
          </div>
        ))}

        <div className="py-1.5 text-center text-[11px] text-[#B9B4C7]">{CONSENT_UPDATED_LABEL}</div>
      </div>

      <div className="sticky bottom-0 z-20 mt-auto shrink-0 border-t border-[#EFEDF4] bg-white px-4 pb-7 pt-3">
        {!atEnd && (
          <div className="flex items-center justify-center gap-1.5 pb-2.5 text-[11px] text-[#9590A8]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9590A8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
            {CONSENT_SCROLL_HINT}
          </div>
        )}

        <button
          type="button"
          onClick={() => setChecked((v) => !v)}
          disabled={!atEnd}
          className="flex w-full items-start gap-2.5 rounded-[13px] border border-[#EFEDF4] bg-[#FAF9FC] p-3 text-left disabled:opacity-60"
        >
          {checked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="#7C3AED" />
              <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="#fff" stroke="#CFC8DE" strokeWidth={2} />
            </svg>
          )}
          <span className="text-[12.5px] leading-[1.65] text-[#3F3B52]">{CONSENT_CHECKBOX_LABEL}</span>
        </button>

        <div className="mt-2.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-[108px] rounded-[15px] bg-[#F1ECFE] py-3.5 text-center text-[15px] font-semibold text-[#7C3AED]"
          >
            {CONSENT_DECLINE_LABEL}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!checked}
            className="flex-1 rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-center text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)] disabled:opacity-45 disabled:shadow-none"
          >
            {CONSENT_ACCEPT_LABEL}
          </button>
        </div>

        <div className="mt-2 text-center text-[10.5px] text-[#B9B4C7]">{CONSENT_FOOTER_NOTE}</div>
      </div>

      {sheetOpen && <ConsentCancelSheet onBack={() => setSheetOpen(false)} onConfirm={onCancel} />}
    </div>
  );
}
```

- [ ] **Step 2: ตรวจโค้ด**

รัน: `npm run lint`
คาดหวัง: ไม่มี error ใหม่

- [ ] **Step 3: คอมมิต**

```bash
git add components/citizen/report/ConsentScreen.tsx
git commit -m "feat(report): จอข้อตกลงก่อนแจ้งเรื่อง ตามอาร์ตบอร์ด 1a"
```

---

## Task 10: ต่อจอข้อตกลงเข้ากับ wizard

**Files:**
- Modify: `pages/report.tsx`

- [ ] **Step 1: เพิ่ม import**

เติมต่อจาก `import StepSuccess from "@/components/citizen/report/StepSuccess";`:

```tsx
import ConsentScreen from "@/components/citizen/report/ConsentScreen";
import { shouldShowConsent } from "@/lib/citizen/report/consent";
import { readConsent, writeConsent } from "@/lib/citizen/report/consentStorage";
```

- [ ] **Step 2: ขยายชนิดของ step**

แทนที่:

```tsx
type Step = 1 | 2 | 3 | "success";
```

ด้วย:

```tsx
// "checking" = กำลังอ่านค่ายินยอมจากเครื่อง ยังไม่วาดอะไร (localStorage อ่านฝั่งเซิร์ฟเวอร์ไม่ได้
// ถ้าเริ่มที่ "consent" คนที่เคยยอมรับแล้วจะเห็นจอข้อตกลงกระพริบ 1 เฟรมทุกครั้ง)
type Step = "checking" | "consent" | 1 | 2 | 3 | "success";
```

- [ ] **Step 3: เปลี่ยนค่าเริ่มต้นของ step และเพิ่ม state ของการยินยอม**

แทนที่:

```tsx
  const [step, setStep] = useState<Step>(1);
```

ด้วย:

```tsx
  const [step, setStep] = useState<Step>("checking");
  const [consent, setConsent] = useState<{ version: string; acceptedAt: string } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
```

- [ ] **Step 4: แทนที่ effect ของ `?category=` ด้วยด่านยินยอม**

แทนที่บล็อกนี้ทั้งก้อน:

```tsx
  // ?category=<Prob_name> จากการ์ดหมวดบนหน้าแรก → ตั้งหมวดแล้วข้ามไปขั้น 2
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.category;
    if (typeof q === "string" && q && !SERVICE_LABELS.includes(q)) {
      setCategory(q);
      setStep(2);
    }
  }, [router.isReady, router.query.category]);
```

ด้วย:

```tsx
  // อ่านค่ายินยอมจากเครื่อง (ทำครั้งเดียวตอน mount — localStorage มีเฉพาะฝั่งเบราว์เซอร์)
  useEffect(() => {
    const stored = readConsent();
    if (stored && !shouldShowConsent(stored)) {
      setConsent({ version: stored.version, acceptedAt: stored.acceptedAt });
    }
    setConsentChecked(true);
  }, []);

  // ด่านเดียวของทุกทางเข้า: ยังไม่ยอมรับ = เห็นจอข้อตกลงก่อนเสมอ
  // ?category=<Prob_name> จากการ์ดหมวดบนหน้าแรก → ตั้งหมวดไว้ แต่ข้ามด่านไม่ได้
  useEffect(() => {
    if (!router.isReady || !consentChecked || step !== "checking") return;
    const q = router.query.category;
    const fromCard = typeof q === "string" && q && !SERVICE_LABELS.includes(q) ? q : "";
    if (fromCard) setCategory(fromCard);
    if (!consent) setStep("consent");
    else setStep(fromCard ? 2 : 1);
  }, [router.isReady, router.query.category, consentChecked, consent, step]);
```

- [ ] **Step 5: เพิ่มตัวจัดการปุ่มของจอข้อตกลง**

เติมต่อจาก effect ด้านบน (ก่อน `const complaintMenu = ...`):

```tsx
  // กดยอมรับ: จำไว้ในเครื่อง → ยิง log แบบไม่รอผล → เข้า wizard
  const handleAcceptConsent = () => {
    const stored = writeConsent();
    setConsent({ version: stored.version, acceptedAt: stored.acceptedAt });
    // fire-and-forget: log ล้มไม่กระทบผู้ใช้ เพราะยังมีหลักฐานแนบไปกับเรื่องตอนส่ง
    void fetch("/api/complaints/consent-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": process.env.NEXT_PUBLIC_APP_ID || "app_b",
      },
      body: JSON.stringify(stored),
      keepalive: true,
    }).catch(() => {});
    setStep(category ? 2 : 1);
  };

  // ยืนยันยกเลิกคำร้อง: ล้างค่าที่ตั้งไว้ (หมวดที่ติดมาจากการ์ดหน้าแรก) แล้วกลับหน้าแรก
  const handleCancelConsent = () => {
    setCategory("");
    setSelectedProblems([]);
    setErrors({});
    router.replace("/");
  };

  // ปุ่มย้อนกลับที่หัวจอข้อตกลง — ออกจากหน้าได้เลย ยังไม่มีข้อมูลที่กรอกไว้ให้เสีย
  const handleExitConsent = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };
```

- [ ] **Step 6: แนบหลักฐานเข้า payload ตอนส่งเรื่อง**

แทนที่:

```tsx
      const payload = buildComplaintPayload(
        { prefix, fullName, phone, community, selectedProblems, category, imageUrls, detail, location },
        problemOptions
      );
```

ด้วย:

```tsx
      const payload = buildComplaintPayload(
        { prefix, fullName, phone, community, selectedProblems, category, imageUrls, detail, location, consent },
        problemOptions
      );
```

- [ ] **Step 7: กัน header ของ wizard ไม่ให้ทำงานตอนอยู่ขั้นข้อตกลง**

แทนที่:

```tsx
  const meta = step === "success" ? null : STEP_META[step];
```

ด้วย:

```tsx
  const meta = step === 1 || step === 2 || step === 3 ? STEP_META[step] : null;
```

- [ ] **Step 8: วาดจอข้อตกลง**

เติมก่อนบรรทัด `{step === 1 && (` :

```tsx
        {step === "consent" && (
          <ConsentScreen
            onAccept={handleAcceptConsent}
            onExit={handleExitConsent}
            onCancel={handleCancelConsent}
          />
        )}
```

- [ ] **Step 9: ตรวจโค้ด + เทสต์**

รัน: `npm run lint && npm test`
คาดหวัง: lint ผ่าน และเทสต์เขียวทั้งหมด

- [ ] **Step 10: คอมมิต**

```bash
git add pages/report.tsx
git commit -m "feat(report): ด่านข้อตกลงก่อนเข้า wizard แจ้งเรื่อง"
```

---

## Task 11: ตรวจด้วยตา + เอกสาร + ปิดงาน

**Files:**
- Modify: `docs/modules/complaints.md`

- [ ] **Step 1: เปิด dev server พอร์ต 3100**

```bash
PORT=3100 npm run dev
```

> ห้ามรัน `npm run build` ขณะ dev server ยังทำงาน (โฟลเดอร์ `.next` เดียวกัน จะทำให้ API ตอบ 500 แบบเงียบ ๆ)

- [ ] **Step 2: ไล่เคสบนเบราว์เซอร์ (มือถือ 390px และจอคอม)**

ล้างค่ายินยอมก่อนทุกครั้งที่ต้องการดูจอข้อตกลงใหม่ ด้วย DevTools Console:

```js
localStorage.removeItem("tk.report.consent");
```

เคสที่ต้องผ่าน:

1. เข้า `http://localhost:3100/report` ครั้งแรก → เห็นจอข้อตกลง ไม่เห็น wizard กระพริบ
2. ยังไม่เลื่อนถึงท้าย → เห็นคำใบ้ "เลื่อนอ่านให้ครบทุกข้อก่อนกดยอมรับ" และกดติ๊กไม่ได้
3. เลื่อนถึงท้าย → คำใบ้หาย ติ๊กได้ ปุ่ม "ยอมรับและเริ่มแจ้งเรื่อง" กดได้
4. กดยอมรับ → เข้าขั้นที่ 1 (เลือกหมวด) และ Network มี `consent-log` ตอบ 204
5. รีเฟรช `/report` → เข้าขั้นที่ 1 ทันที ไม่เห็นจอข้อตกลงอีก
6. ล้างค่าแล้วเข้า `http://localhost:3100/report?category=ไฟฟ้าสาธารณะ` (ใช้ชื่อหมวดจริงจากหน้าแรก)
   → เห็นจอข้อตกลงก่อน กดยอมรับแล้วเข้าขั้นที่ 2 โดยหมวดถูกตั้งไว้แล้ว
7. ล้างค่า เข้าใหม่ กด "ไม่ยอมรับ" → เห็นแผ่นยืนยัน · กด "กลับไปยอมรับ" ปิดแผ่น ·
   กด "ยืนยันยกเลิกคำร้อง" กลับหน้าแรก · เข้า `/report` อีกครั้งต้องเจอจอข้อตกลงอีก
8. ปุ่มโทร 191 และ 056261500 เป็นลิงก์ `tel:` ที่กดได้
9. เปิดหน้าต่างส่วนตัว (private window) → เห็นจอข้อตกลง กดยอมรับแล้วเข้า wizard ได้ตามปกติ

> **ห้ามกดส่งเรื่องจริง** — เครื่องนี้ต่อฐานข้อมูลจริง จะสร้างเรื่องจริงและเด้งแจ้งเตือนเข้ากลุ่ม LINE
> เจ้าหน้าที่ การทดสอบส่งจริงเป็นการตัดสินใจของเจ้าของโปรเจกต์

- [ ] **Step 3: ปิด dev server**

Ctrl+C ที่เทอร์มินัลที่รัน dev แล้วยืนยันว่าไม่มีตัวค้าง:

รัน: `pgrep -fl "next dev" || echo "ไม่มี dev server ค้าง"`
คาดหวัง: `ไม่มี dev server ค้าง`

- [ ] **Step 4: อัปเดตเอกสารโมดูล**

เพิ่มหัวข้อนี้ใน `docs/modules/complaints.md` ต่อจากหัวข้อ "PDPA / เรื่องลับ":

```markdown
## ข้อตกลงก่อนแจ้งเรื่อง (consent)

- จอข้อตกลงเป็น **ขั้นที่ 0 ของ `/report`** (ไม่ใช่ route แยก) — ทุกทางเข้ารวมถึง
  `?category=` จากการ์ดหน้าแรกต้องผ่านด่านนี้ก่อน กั้นไว้**ก่อนขั้นแนบรูป** เพราะ
  `PhotoUploader` อัปโหลดขึ้น Cloudinary ทันทีที่เลือกไฟล์ และ cloud นั้นใช้ร่วมกับ
  แอปพี่น้อง (ลบไฟล์กำพร้าไม่ได้)
- ข้อความ + เลขฉบับอยู่ `lib/citizen/report/consentContent.js` **ที่เดียว** — ขยับ
  `CONSENT_VERSION` = คนที่เคยยอมรับฉบับเก่าเห็นจออีกครั้ง (อย่าลบเลขฉบับเก่าออกจาก
  `KNOWN_CONSENT_VERSIONS` เพราะ API log ใช้ตรวจ body)
- หลักฐาน 3 ชั้น: `localStorage` คีย์ `tk.report.consent` · ฟิลด์ `consent` บนเอกสารเรื่อง
  (**ต้องมีทั้ง `models/Complaint.js` และ `models/SubmittedReport.js`**) · collection
  `report_consent_logs` เขียนผ่าน `POST /api/complaints/consent-log` (ทางเขียนสาธารณะ
  ไม่มี GET · upsert ด้วย `{deviceId, version}` · ไม่เก็บ IP/user-agent)
- ข้อ 3 ของข้อตกลงอ้างสถานะ "ตรวจสอบแล้วไม่พบเหตุ ณ เวลาปฏิบัติการ" /
  "บันทึกข้อมูลเพื่อเฝ้าระวัง" ซึ่ง **ยังไม่มีใน `lib/tasks/status.js`** — เจ้าของรับทราบแล้ว
  รอตัดสินใจตัด/ย่อ หรือเพิ่มสถานะจริงในรอบของโมดูล tasks
- สเปค: `docs/superpowers/specs/2026-09-16-report-consent-design.md` ·
  แบบ: `docs/design_handoff_report_consent/`
```

- [ ] **Step 5: ตรวจครบก่อนปิดงาน**

รัน: `npm test`
คาดหวัง: PASS ทั้งหมด

รัน: `npm run lint`
คาดหวัง: ไม่มี error

รัน: `npm run build`
คาดหวัง: build ผ่าน (ต้องปิด dev server ก่อนเท่านั้น)

- [ ] **Step 6: คอมมิต**

```bash
git add docs/modules/complaints.md
git commit -m "docs(complaints): บันทึกขั้นข้อตกลงก่อนแจ้งเรื่อง"
```

---

## เช็กลิสต์ก่อนส่งมอบ

- [ ] `npm test` เขียว · `npm run lint` สะอาด · `npm run build` ผ่าน
- [ ] ไม่มี dev server ค้างในเครื่องเจ้าของ (`pgrep -fl "next dev"` ว่าง)
- [ ] ไม่มีแถว `smoke-test-` ค้างใน `report_consent_logs`
- [ ] ไม่ได้ส่งเรื่องร้องเรียนจริงระหว่างทดสอบ
- [ ] แคปหน้าจอจอข้อตกลง + แผ่นยืนยันยกเลิก ส่งให้เจ้าของดูก่อนตัดสินใจเรื่องข้อความข้อ 3
