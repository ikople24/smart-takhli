// lib/citizen/__tests__/reportConsent.test.js
import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  KNOWN_CONSENT_VERSIONS,
  CONSENT_SECTIONS,
  CONSENT_INTRO,
  EMERGENCY,
  CONSENT_CHECKBOX_LABEL,
  CONSENT_UPDATED_LABEL,
} from "../report/consentContent";
import {
  parseStoredConsent,
  shouldShowConsent,
  validateConsentLog,
  consentForPayload,
  ACCEPTED_AT_MAX_LENGTH,
} from "../report/consent";
import {
  CONSENT_STORAGE_KEY,
  newDeviceId,
  readConsent,
  writeConsent,
} from "../report/consentStorage";
import { DEVICE_ID_PATTERN } from "../report/consent";

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
      expect((s.paragraphs ?? []).length).toBeGreaterThan(0);
      for (const para of s.paragraphs ?? []) {
        expect(para.length).toBeGreaterThan(0);
        for (const run of para) {
          expect(typeof run.t).toBe("string");
          expect(run.t.length).toBeGreaterThan(0);
        }
      }
      for (const item of s.chips ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const item of s.denyList ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const item of s.statusChips ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const run of s.tailParagraph ?? []) {
        expect(typeof run.t).toBe("string");
        expect(run.t.length).toBeGreaterThan(0);
      }
    }

    // การมีอยู่ของ field (ไม่ใช่แค่เนื้อหาข้างในไม่ว่าง) — for...of บน array ว่างไม่รันเลย
    // จึงต้องเช็คความยาว array เองตรง ๆ ว่าไม่ถูกลบ/ล้างทั้งชุด โดยเฉพาะ denyList ของข้อ 2
    // ที่เป็นรายการข้อยกเว้นตามกฎหมาย
    expect(CONSENT_SECTIONS[0].chips.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[1].denyList.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[2].statusChips.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[2].tailParagraph.length).toBeGreaterThan(0);
  });

  it("ป้ายวันที่อ้างเลขฉบับจากค่าคงที่เดียวกับ CONSENT_VERSION", () => {
    expect(CONSENT_UPDATED_LABEL).toContain(`ฉบับที่ ${CONSENT_VERSION}`);
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

// รายชื่อฉบับที่เคยขึ้นใช้งานจริงมาแล้วทุกฉบับ — "เพิ่มได้ ห้ามลบ"
// ออกฉบับใหม่เมื่อไหร่ ค่อยเติมเลขต่อท้ายได้ (ไม่เติมก็ไม่พัง) แต่ห้ามลบของเดิมออก
const SHIPPED_CONSENT_VERSIONS = ["1.0"];

describe("KNOWN_CONSENT_VERSIONS — ฉบับเก่าห้ามหาย", () => {
  // คอมเมนต์ใน consentContent.js สั่งไว้ว่าห้ามลบเลขฉบับเก่า แต่คอมเมนต์บังคับอะไรไม่ได้
  // เครื่องที่ยังค้าง bundle เก่า (แท็บที่เปิดทิ้งไว้ / เบราว์เซอร์แคช) จะยิงเลขฉบับเก่าเข้า
  // POST /api/complaints/consent-log ต่อไปอีกนานหลังออกฉบับใหม่ — ถ้าเลขนั้นถูกลบออกจากรายชื่อ
  // เซิร์ฟเวอร์จะตอบ "เลขฉบับข้อตกลงไม่ถูกต้อง" และหลักฐานการยอมรับจะหายเงียบ ๆ
  //
  // เทสนี้ล็อกแค่ "ต้องมีครบทุกฉบับที่เคยปล่อย" ไม่ได้ล็อกว่ามีได้เท่านี้
  // เพิ่มฉบับใหม่เข้า KNOWN_CONSENT_VERSIONS จึงไม่ต้องกลับมาแก้เทสนี้
  it("ทุกฉบับที่เคยปล่อยใช้งานยังอยู่ในรายชื่อ (ลบออก = เทสแดง)", () => {
    expect(KNOWN_CONSENT_VERSIONS).toEqual(expect.arrayContaining(SHIPPED_CONSENT_VERSIONS));
  });

  it("ทุกฉบับที่เคยปล่อยยังส่ง consent log ผ่าน (ผลจริงของการลบ)", () => {
    for (const version of SHIPPED_CONSENT_VERSIONS) {
      const result = validateConsentLog({
        version,
        acceptedAt: new Date().toISOString(),
        deviceId: "3f1a5c22-1111-4222-8333-444455556666",
      });
      expect(result.ok, `ฉบับ ${version} ถูกปฏิเสธ`).toBe(true);
      expect(result.value.version).toBe(version);
    }
  });
});

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

  it("เป็น JSON array หรือสตริง 'undefined' (localStorage เพี้ยน) → null", () => {
    expect(parseStoredConsent("[]")).toBeNull();
    expect(parseStoredConsent("undefined")).toBeNull();
  });

  it("มีฟิลด์เกินมา → ทิ้งฟิลด์เกิน คืนเฉพาะ 3 ฟิลด์ที่รู้จัก", () => {
    const raw = JSON.stringify({
      version: "1.0",
      acceptedAt: "2026-09-16T02:31:00.000Z",
      deviceId: "3f1a5c22-1111-4222-8333-444455556666",
      extra: "x",
    });
    const result = parseStoredConsent(raw);
    expect(Object.keys(result).sort()).toEqual(["acceptedAt", "deviceId", "version"]);
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

  it("acceptedAt ยาวผิดปกติ (สตริง 10,000 ตัวอักษร) → ใช้เวลาเซิร์ฟเวอร์แทน แต่ยัง ok", () => {
    const r = validateConsentLog({ ...okBody, acceptedAt: "a".repeat(10000) }, now);
    expect(r.ok).toBe(true);
    expect(r.value.acceptedAt.toISOString()).toBe(now.toISOString());
  });
});

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

describe("consentForPayload — ข้อมูลยินยอมที่แนบไป payload ตอนส่งเรื่องร้องเรียนได้", () => {
  const valid = {
    version: "1.0",
    acceptedAt: "2026-09-16T02:31:00.000Z",
    deviceId: "3f1a5c22-1111-4222-8333-444455556666",
  };

  it("ค่าถูกต้อง → คืนอ็อบเจกต์ครบเฉพาะ 2 ฟิลด์ version กับ acceptedAt", () => {
    const result = consentForPayload(valid);
    expect(result).toEqual({ version: "1.0", acceptedAt: "2026-09-16T02:31:00.000Z" });
    expect(Object.keys(result).sort()).toEqual(["acceptedAt", "version"]);
  });

  it("มี deviceId หรือฟิลด์อื่นเกินมา → ทิ้งหมด ไม่ติดไปด้วย", () => {
    const result = consentForPayload({ ...valid, extra: "x" });
    expect(Object.keys(result).sort()).toEqual(["acceptedAt", "version"]);
  });

  it("ไม่มี version → null", () => {
    expect(consentForPayload({ acceptedAt: valid.acceptedAt })).toBeNull();
    expect(consentForPayload({ ...valid, version: "" })).toBeNull();
    expect(consentForPayload({ ...valid, version: 1 })).toBeNull();
  });

  it("ไม่มี acceptedAt → null", () => {
    expect(consentForPayload({ version: valid.version })).toBeNull();
    expect(consentForPayload({ ...valid, acceptedAt: "" })).toBeNull();
  });

  it("acceptedAt parse เป็นวันที่ไม่ได้ → null (กัน CastError ตอนเซฟ SubmittedReport)", () => {
    expect(consentForPayload({ ...valid, acceptedAt: "not-a-date" })).toBeNull();
  });

  it(`acceptedAt ยาวเกิน ACCEPTED_AT_MAX_LENGTH (${ACCEPTED_AT_MAX_LENGTH}) เช่น 10,000 ตัวอักษร → null`, () => {
    expect(consentForPayload({ ...valid, acceptedAt: "a".repeat(10000) })).toBeNull();
  });

  it("ค่า input เป็น null หรือไม่ใช่อ็อบเจกต์ → null", () => {
    expect(consentForPayload(null)).toBeNull();
    expect(consentForPayload(undefined)).toBeNull();
    expect(consentForPayload("x")).toBeNull();
    expect(consentForPayload(42)).toBeNull();
    expect(consentForPayload([])).toBeNull();
  });
});
