# Smart Light (เสาไฟสาธารณะ กองช่าง) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างโมดูล `smart-light` — ทะเบียนเสาไฟสาธารณะ LED 1,067 ต้นบนแผนที่ Leaflet ให้เจ้าหน้าที่กองช่างสำรวจ/บันทึกสภาพ/เพิ่ม/แก้ไข/จัดกลุ่มตามชุมชน พร้อมค้นหาจาก GPS + ปุ่มนำทาง

**Architecture:** โมดูลเต็มตาม convention ของ repo (`pages/admin/smart-light.jsx` + `pages/api/smart-light/` + `components/smart-light/` + `lib/smart-light/` + `models/smart-light/`) เก็บ 1 collection `street_light_poles` ประวัติสำรวจ embedded ใน pole doc; seed ครั้งเดียวจาก KMZ ด้วย script idempotent; แผนที่เรนเดอร์ 2 ระดับตามซูม (bubble รายกลุ่ม ↔ หมุดรายต้นเฉพาะในกรอบจอ) โหลดข้อมูลครั้งเดียวแล้วกรองฝั่ง client

**Tech Stack:** Next.js 15 Pages Router, React 19, Mongoose (MongoDB), Clerk (`getAuth` + Mongo user re-verify ตามแบบ `pages/api/pm25/_auth.js`), react-leaflet 5 + leaflet 1.9 (มีอยู่แล้ว — ห้ามเพิ่ม dependency ใหม่), Tailwind v4 + DaisyUI, Cloudinary unsigned upload

**Spec:** `docs/superpowers/specs/2026-07-10-smart-light-design.md` — อ่านก่อนเริ่ม

**ข้อควรรู้ก่อนเริ่ม (สำคัญ):**
- repo นี้**ไม่มี test runner** (ดู CLAUDE.md) — การ verify แต่ละ task ใช้ `npm run lint`, `npm run build`, `node` script ตรง ๆ และ curl/เปิดหน้าเว็บ ห้ามติดตั้ง test framework เพิ่ม
- ตัวแปร DB คือ **`MONGO_URI`** (ไม่ใช่ MONGODB_URI) ใน `.env.local`
- dev server: `npm run dev` → http://localhost:3000 (ถ้า port ชนให้ดู output จริง)
- ทำงานบน branch `feat-smart-light` (แตกจาก `main` แล้ว มี spec commit อยู่)
- ทุก commit ลงท้าย `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- ห้าม commit ไฟล์ `.agents/`, `AGENTS.md` (ของ session อื่น ไม่เกี่ยวกับงานนี้)
- enum เก็บเป็นอังกฤษใน DB, แสดงผลภาษาไทยผ่าน constants เสมอ — UI ข้อความภาษาไทยทั้งหมด

---

### Task 1: Constants + Geo helpers + Mongoose model

**Files:**
- Create: `lib/smart-light/constants.js`
- Create: `lib/smart-light/geo.js`
- Create: `models/smart-light/StreetLightPole.js`

- [ ] **Step 1: สร้าง `lib/smart-light/constants.js`**

```js
// ค่าคงที่โมดูลเสาไฟสาธารณะ (smart-light) — enum + label/สี ใช้ร่วมกัน UI และ API

// สถานะเสา: เก็บใน DB เป็นอังกฤษ แสดงผลไทย + สีหมุดบนแผนที่
export const POLE_STATUS = {
  normal: { label: "ปกติ", color: "#16A34A" },
  damaged: { label: "ชำรุด", color: "#F59E0B" },
  off: { label: "ดับ", color: "#DC2626" },
  unknown: { label: "ยังไม่สำรวจ", color: "#9CA3AF" },
};
export const POLE_STATUS_VALUES = Object.keys(POLE_STATUS);
// สถานะที่บันทึกจากการสำรวจได้ (ไม่รวม unknown ซึ่งเป็นค่าตั้งต้นเท่านั้น)
export const SURVEY_STATUS_VALUES = ["normal", "damaged", "off"];

export const LAMP_TYPE = {
  led: { label: "LED" },
  other: { label: "หลอดอื่น" },
  unknown: { label: "ไม่ระบุ" },
};
export const LAMP_TYPE_VALUES = Object.keys(LAMP_TYPE);

// รหัสเสา TK-LED-ปปดด##### (ปี พ.ศ. 2 หลัก + เดือน 2 หลัก + เลขต้น 5 หลักวิ่งต่อเนื่อง)
export const POLE_CODE_PREFIX = "TK-LED";

// เรนเดอร์ตามสเกลซูม: zoom >= ค่านี้วาดหมุดรายต้น, ต่ำกว่าวาด bubble รายกลุ่ม
export const POLE_ZOOM_THRESHOLD = 15;

// ศูนย์กลางเริ่มต้น (เทศบาลเมืองตาคลี — ค่าเดียวกับ MapPoints ของ smart-school)
export const DEFAULT_MAP_CENTER = [15.259, 100.349];
export const DEFAULT_MAP_ZOOM = 13;
```

- [ ] **Step 2: สร้าง `lib/smart-light/geo.js`**

```js
// ฟังก์ชันภูมิศาสตร์ฝั่ง client ของโมดูล smart-light

// ระยะทางระหว่างสองพิกัดเป็นเมตร (haversine)
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ลิงก์นำทาง Google Maps (มือถือเด้งเข้าแอปแผนที่)
export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// แปลงข้อความเป็นพิกัด ถ้า input เป็นรูปแบบ "lat,lng" — ไม่ใช่คืน null
export function parseLatLng(text) {
  const m = String(text || "").match(
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
  );
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
```

- [ ] **Step 3: สร้าง `models/smart-light/StreetLightPole.js`**

```js
import mongoose from "mongoose";

// ทะเบียนเสาไฟสาธารณะ — 1 เอกสาร = 1 ต้น (โมดูล smart-light กองช่าง)
// ประวัติสำรวจ embedded ในเอกสารเสา (จำนวนครั้งต่อเสาต่ำ ไม่คุ้มแยก collection)
const SurveyEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["normal", "damaged", "off"],
      required: true,
    },
    photoUrl: { type: String, default: "" },
    note: { type: String, default: "" },
    surveyedAt: { type: Date, required: true },
    surveyedBy: { type: String, default: "" }, // ชื่อผู้สำรวจ
    surveyedByClerkId: { type: String, default: "" },
  },
  { _id: false }
);

const StreetLightPoleSchema = new mongoose.Schema(
  {
    // TK-LED-ปปดด##### เช่น TK-LED-690700001 — เลขต้น 5 หลักวิ่งต่อเนื่อง ไม่รีเซ็ตตามเดือน
    code: { type: String, required: true },
    name: { type: String, default: "" }, // ชื่อ/เลขเดิมจากไฟล์ KMZ (เช่น "Marker 12")
    group: { type: String, required: true }, // ชุมชน/กลุ่ม — ย้ายกลุ่มได้ผ่านฟอร์มแก้ไข
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    lampType: {
      type: String,
      enum: ["led", "other", "unknown"],
      default: "unknown",
    },
    status: {
      type: String,
      enum: ["normal", "damaged", "off", "unknown"],
      default: "unknown",
    },
    photoUrl: { type: String, default: "" }, // รูปล่าสุด (Cloudinary)
    note: { type: String, default: "" },
    lastSurveyedAt: { type: Date, default: null },
    lastSurveyedBy: { type: String, default: "" },
    surveys: { type: [SurveyEntrySchema], default: [] },
    source: {
      type: String,
      enum: ["kmz-import", "manual"],
      default: "manual",
    },
  },
  { collection: "street_light_poles", timestamps: true }
);

StreetLightPoleSchema.index({ code: 1 }, { unique: true });
StreetLightPoleSchema.index({ group: 1 });

export default mongoose.models.StreetLightPole ||
  mongoose.model("StreetLightPole", StreetLightPoleSchema);
```

- [ ] **Step 4: ตรวจ lint**

Run: `npm run lint`
Expected: ผ่าน ไม่มี error ใหม่ (warning เดิมของ repo ไม่นับ)

- [ ] **Step 5: Commit**

```bash
git add lib/smart-light/ models/smart-light/
git commit -m "feat(smart-light): constants + geo helpers + StreetLightPole model"
```

---

### Task 2: Auth helper + ตัวสร้างรหัสเสา

**Files:**
- Create: `pages/api/smart-light/_auth.js`
- Create: `lib/smart-light/poleCode.js`

- [ ] **Step 1: สร้าง `pages/api/smart-light/_auth.js`** — ก็อปแบบ `pages/api/smart-school/_auth.js` ทั้งโครง เปลี่ยนเฉพาะชื่อ/หน้า (ไฟล์ขึ้นต้น `_` Next ไม่ทำเป็น route — pattern เดียวกับ pm25/smart-school/smart-papar)

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-light";

export async function requireSmartLightAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  const isSuperAdmin = role === "superadmin";

  if (isSuperAdmin) {
    return {
      ok: true,
      userId,
      role,
      isSuperAdmin: true,
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
    };
  }

  await dbConnect();
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      isActive: { type: Boolean, default: true },
      isArchived: { type: Boolean, default: false },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const hasPageAccess = allowed.length === 0 || allowed.includes(REQUIRED_PAGE);
  if (!hasPageAccess) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: mongoUser.role || role,
    isSuperAdmin: false,
    name: mongoUser.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
  };
}
```

- [ ] **Step 2: สร้าง `lib/smart-light/poleCode.js`**

```js
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { POLE_CODE_PREFIX } from "./constants";

// "ปปดด" = ปี พ.ศ. 2 หลัก + เดือน 2 หลัก ตามเวลาไทย เช่น ก.ค. 2026 → "6907"
export function buddhistYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year").value) + 543;
  const month = parts.find((p) => p.type === "month").value;
  return `${String(year % 100).padStart(2, "0")}${month}`;
}

export function formatPoleCode(yymm, running) {
  return `${POLE_CODE_PREFIX}-${yymm}${String(running).padStart(5, "0")}`;
}

// รหัสเสาถัดไป — เลขต้น 5 หลักท้ายวิ่งต่อเนื่องทั้งระบบ ไม่รีเซ็ตตามเดือน
// (ปปดดเพิ่มขึ้นตามเวลา + เลขต้นไม่รีเซ็ต → sort code แบบ string desc ได้ตัวเลขต้นสูงสุดเสมอ)
// ต้องเรียกหลัง dbConnect() แล้วเท่านั้น
export async function nextPoleCode() {
  const last = await StreetLightPole.findOne({
    code: new RegExp(`^${POLE_CODE_PREFIX}-\\d{9}$`),
  })
    .sort({ code: -1 })
    .select("code")
    .lean();
  const lastRunning = last ? Number(last.code.slice(-5)) : 0;
  return formatPoleCode(buddhistYearMonth(), lastRunning + 1);
}
```

- [ ] **Step 3: verify ฟังก์ชัน format แบบเร็ว**

Run:
```bash
node -e '
const yymm = (() => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(new Date("2026-07-10T12:00:00+07:00"));
  const year = Number(parts.find(p => p.type === "year").value) + 543;
  const month = parts.find(p => p.type === "month").value;
  return `${String(year % 100).padStart(2, "0")}${month}`;
})();
console.log(yymm, `TK-LED-${yymm}${String(1).padStart(5, "0")}`);
'
```
Expected output: `6907 TK-LED-690700001`

- [ ] **Step 4: lint + commit**

```bash
npm run lint
git add pages/api/smart-light/_auth.js lib/smart-light/poleCode.js
git commit -m "feat(smart-light): auth helper + pole code generator (TK-LED-ปปดด#####)"
```

---

### Task 3: API — รายการเสา + เพิ่มเสา (`/api/smart-light/poles`)

**Files:**
- Create: `pages/api/smart-light/poles/index.js`

- [ ] **Step 1: สร้าง `pages/api/smart-light/poles/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";
import { nextPoleCode } from "@/lib/smart-light/poleCode";
import { POLE_STATUS_VALUES, LAMP_TYPE_VALUES } from "@/lib/smart-light/constants";

// validate พิกัดช่วงประเทศไทยแบบหยาบ — กัน lat/lng สลับกันหรือพิมพ์ผิด
export function validateCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "พิกัดต้องเป็นตัวเลข";
  if (la < 5 || la > 21 || ln < 97 || ln > 106) return "พิกัดอยู่นอกช่วงประเทศไทย";
  return null;
}

export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  if (req.method === "GET") {
    try {
      const { group, status } = req.query;
      const query = {};
      if (group) query.group = String(group);
      if (status) {
        if (!POLE_STATUS_VALUES.includes(String(status))) {
          return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
        }
        query.status = String(status);
      }
      // ไม่ส่ง surveys[] ในหน้า list — โหลดครั้งเดียว ~1,067 แถวให้ payload เบา
      const items = await StreetLightPole.find(query)
        .select("-surveys")
        .sort({ code: 1 })
        .lean();
      return res.status(200).json({ success: true, data: items });
    } catch (error) {
      console.error("smart-light poles GET error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "POST") {
    try {
      const { lat, lng, group, lampType, note, photoUrl, name } = req.body || {};

      const coordError = validateCoords(lat, lng);
      if (coordError) {
        return res.status(400).json({ success: false, message: coordError });
      }
      const groupName = String(group || "").trim();
      if (!groupName) {
        return res.status(400).json({ success: false, message: "กรุณาระบุชุมชน/กลุ่ม" });
      }
      if (lampType && !LAMP_TYPE_VALUES.includes(String(lampType))) {
        return res.status(400).json({ success: false, message: "ชนิดโคมไม่ถูกต้อง" });
      }

      // gen code แล้ว insert — ถ้าชน unique (insert พร้อมกัน) ลองใหม่สูงสุด 3 ครั้ง
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const code = await nextPoleCode();
          const doc = await StreetLightPole.create({
            code,
            name: String(name || "").trim(),
            group: groupName,
            lat: Number(lat),
            lng: Number(lng),
            lampType: lampType || "unknown",
            note: String(note || ""),
            photoUrl: String(photoUrl || ""),
            source: "manual",
          });
          return res.status(201).json({ success: true, data: doc });
        } catch (error) {
          if (error?.code === 11000) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    } catch (error) {
      console.error("smart-light poles POST error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
```

- [ ] **Step 2: verify — endpoint ต้องปฏิเสธคนไม่ล็อกอิน**

Run (ต้องมี dev server รันอยู่: `npm run dev` อีก terminal หรือรัน background):
```bash
curl -s http://localhost:3000/api/smart-light/poles
```
Expected: `{"success":false,"message":"Unauthorized"}`

- [ ] **Step 3: lint + commit**

```bash
npm run lint
git add pages/api/smart-light/poles/index.js
git commit -m "feat(smart-light): API รายการเสา + เพิ่มเสาใหม่"
```

---

### Task 4: API — รายเสา (GET/PUT/DELETE) + บันทึกสภาพ

**Files:**
- Create: `pages/api/smart-light/poles/[id].js`
- Create: `pages/api/smart-light/poles/[id]/survey.js`

(Next.js Pages Router รองรับ `[id].js` คู่กับโฟลเดอร์ `[id]/` ได้ — `/poles/:id` กับ `/poles/:id/survey` แยก route กัน)

- [ ] **Step 1: สร้าง `pages/api/smart-light/poles/[id].js`**

```js
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";
import { validateCoords } from "./index";
import { LAMP_TYPE_VALUES } from "@/lib/smart-light/constants";

export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  const { id } = req.query;
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, message: "รหัสอ้างอิงไม่ถูกต้อง" });
  }

  if (req.method === "GET") {
    try {
      const doc = await StreetLightPole.findById(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: doc });
    } catch (error) {
      console.error("smart-light pole GET error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { group, lampType, lat, lng, note, name } = req.body || {};
      const update = {};

      if (group !== undefined) {
        const groupName = String(group).trim();
        if (!groupName) {
          return res.status(400).json({ success: false, message: "ชุมชน/กลุ่มห้ามว่าง" });
        }
        update.group = groupName;
      }
      if (lampType !== undefined) {
        if (!LAMP_TYPE_VALUES.includes(String(lampType))) {
          return res.status(400).json({ success: false, message: "ชนิดโคมไม่ถูกต้อง" });
        }
        update.lampType = lampType;
      }
      if (lat !== undefined || lng !== undefined) {
        const coordError = validateCoords(lat, lng);
        if (coordError) {
          return res.status(400).json({ success: false, message: coordError });
        }
        update.lat = Number(lat);
        update.lng = Number(lng);
      }
      if (note !== undefined) update.note = String(note);
      if (name !== undefined) update.name = String(name).trim();

      const doc = await StreetLightPole.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true }
      ).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: doc });
    } catch (error) {
      console.error("smart-light pole PUT error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const doc = await StreetLightPole.findByIdAndDelete(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: { deletedCode: doc.code } });
    } catch (error) {
      console.error("smart-light pole DELETE error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
```

- [ ] **Step 2: สร้าง `pages/api/smart-light/poles/[id]/survey.js`**

```js
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../../_auth";
import { SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";

// POST /api/smart-light/poles/:id/survey — บันทึกสภาพจากการสำรวจหน้างาน
// push เข้า surveys[] + อัปเดตสถานะปัจจุบัน/รูปล่าสุด/ผู้สำรวจล่าสุด
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  const { id } = req.query;
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, message: "รหัสอ้างอิงไม่ถูกต้อง" });
  }

  try {
    const { status, photoUrl, note } = req.body || {};
    if (!SURVEY_STATUS_VALUES.includes(String(status))) {
      return res
        .status(400)
        .json({ success: false, message: "สถานะต้องเป็น ปกติ/ชำรุด/ดับ เท่านั้น" });
    }

    const entry = {
      status: String(status),
      photoUrl: String(photoUrl || ""),
      note: String(note || ""),
      surveyedAt: new Date(),
      surveyedBy: auth.name || "",
      surveyedByClerkId: auth.userId,
    };

    const set = {
      status: entry.status,
      lastSurveyedAt: entry.surveyedAt,
      lastSurveyedBy: entry.surveyedBy,
    };
    if (entry.photoUrl) set.photoUrl = entry.photoUrl; // ไม่มีรูปใหม่ → คงรูปเดิมไว้

    const doc = await StreetLightPole.findByIdAndUpdate(
      id,
      { $push: { surveys: entry }, $set: set },
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
    }
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("smart-light survey POST error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
```

- [ ] **Step 3: verify — ทั้งสอง endpoint ปฏิเสธคนไม่ล็อกอิน**

Run:
```bash
curl -s http://localhost:3000/api/smart-light/poles/000000000000000000000000
curl -s -X POST http://localhost:3000/api/smart-light/poles/000000000000000000000000/survey
```
Expected: ทั้งคู่ตอบ `{"success":false,"message":"Unauthorized"}`

- [ ] **Step 4: lint + commit**

```bash
npm run lint
git add "pages/api/smart-light/poles/[id].js" "pages/api/smart-light/poles/[id]/survey.js"
git commit -m "feat(smart-light): API รายเสา (ดู/แก้/ลบ) + บันทึกสภาพสำรวจ"
```

---

### Task 5: API — กลุ่ม/ชุมชน (สรุป + เปลี่ยนชื่อ)

**Files:**
- Create: `pages/api/smart-light/groups/index.js`
- Create: `pages/api/smart-light/groups/rename.js`

- [ ] **Step 1: สร้าง `pages/api/smart-light/groups/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";

// GET /api/smart-light/groups — รายชื่อกลุ่ม + จำนวนแยกสถานะ + centroid
// centroid ใช้วาด bubble รายกลุ่มบนแผนที่ตอนซูมไกล
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const rows = await StreetLightPole.aggregate([
      {
        $group: {
          _id: "$group",
          total: { $sum: 1 },
          normal: { $sum: { $cond: [{ $eq: ["$status", "normal"] }, 1, 0] } },
          damaged: { $sum: { $cond: [{ $eq: ["$status", "damaged"] }, 1, 0] } },
          off: { $sum: { $cond: [{ $eq: ["$status", "off"] }, 1, 0] } },
          unknown: { $sum: { $cond: [{ $eq: ["$status", "unknown"] }, 1, 0] } },
          lat: { $avg: "$lat" },
          lng: { $avg: "$lng" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const data = rows.map((r) => ({
      group: r._id,
      total: r.total,
      byStatus: { normal: r.normal, damaged: r.damaged, off: r.off, unknown: r.unknown },
      centroid: { lat: r.lat, lng: r.lng },
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("smart-light groups GET error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
```

- [ ] **Step 2: สร้าง `pages/api/smart-light/groups/rename.js`**

```js
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";

// PUT /api/smart-light/groups/rename — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม (updateMany)
// ไว้แก้ชื่อพิมพ์ผิดจากไฟล์ KMZ เดิม เช่น "ตลีคลี", "เอื่ออารี"
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const from = String(req.body?.from || "").trim();
    const to = String(req.body?.to || "").trim();
    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "กรุณาระบุชื่อกลุ่มเดิมและชื่อกลุ่มใหม่" });
    }
    if (from === to) {
      return res.status(400).json({ success: false, message: "ชื่อกลุ่มใหม่ซ้ำกับชื่อเดิม" });
    }

    const result = await StreetLightPole.updateMany(
      { group: from },
      { $set: { group: to } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `ไม่พบกลุ่ม "${from}"` });
    }
    return res
      .status(200)
      .json({ success: true, data: { modified: result.modifiedCount } });
  } catch (error) {
    console.error("smart-light groups rename error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
```

- [ ] **Step 3: verify + lint + commit**

```bash
curl -s http://localhost:3000/api/smart-light/groups
# Expected: {"success":false,"message":"Unauthorized"}
npm run lint
git add pages/api/smart-light/groups/
git commit -m "feat(smart-light): API สรุปกลุ่ม+centroid และเปลี่ยนชื่อกลุ่ม"
```

---

### Task 6: Seed script จาก KMZ + รันจริง

**Files:**
- Create: `scripts/import-street-light-kmz.js`
- Commit ด้วย: `public/point_of_ligth/` (ไฟล์ข้อมูลดิบ 5 ไฟล์ — เก็บใน repo เป็น backup ตาม spec)

**ข้อมูลไฟล์:** `public/point_of_ligth/export_2025_03_27-00_14_07.kmz` เป็น zip ข้างในมี `doc.kml` เดียว โครง: `<Folder id="N"><name>ชื่อกลุ่ม</name>…<Placemark><name>Marker X</name>…<Point><coordinates>lng,lat,alt</coordinates>…` รวม 21 folders / 1,067 placemarks — แตก zip ด้วยคำสั่ง `unzip` ของระบบ (macOS/Linux มีอยู่แล้ว ไม่เพิ่ม dependency)

- [ ] **Step 1: สร้าง `scripts/import-street-light-kmz.js`** (CommonJS ตามแบบ script อื่นใน repo)

```js
// One-time seed: นำเข้าเสาไฟจาก KMZ (MapMarker export) → collection street_light_poles
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/import-street-light-kmz.js --dry-run
//   node --env-file=.env.local scripts/import-street-light-kmz.js
//
// Idempotent: เช็คซ้ำรายจุดด้วยคีย์ (source, group, name) — รันซ้ำไม่สร้างซ้ำ
// และไม่ทับข้อมูลที่เจ้าหน้าที่แก้ไปแล้ว (ข้ามจุดที่มีอยู่)
// รหัสเสา TK-LED-ปปดด##### เลขต้นวิ่งต่อจากเลขสูงสุดใน DB

const { execFileSync } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");

const KMZ_PATH = path.join(
  __dirname,
  "..",
  "public",
  "point_of_ligth",
  "export_2025_03_27-00_14_07.kmz"
);
const PREFIX = "TK-LED";

function buddhistYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year").value) + 543;
  const month = parts.find((p) => p.type === "month").value;
  return `${String(year % 100).padStart(2, "0")}${month}`;
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// doc.kml จาก MapMarker โครงสร้างสม่ำเสมอ — แกะ Folder/Placemark ด้วย regex ได้
function parseKml(xml) {
  const folders = [];
  const chunks = xml.split(/<Folder[^>]*>/).slice(1);
  for (const chunk of chunks) {
    const body = chunk.split("</Folder>")[0];
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const group = nameMatch ? decodeXml(nameMatch[1].trim()) : "ไม่ระบุกลุ่ม";
    const points = [];
    const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
    let m;
    while ((m = placemarkRe.exec(body))) {
      const pm = m[1];
      const pName = pm.match(/<name>([\s\S]*?)<\/name>/);
      const coord = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!coord) continue;
      const [lng, lat] = coord[1].trim().split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      points.push({ name: pName ? decodeXml(pName[1].trim()) : "", lat, lng });
    }
    folders.push({ group, points });
  }
  return folders;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }

  const xml = execFileSync("unzip", ["-p", KMZ_PATH, "doc.kml"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const folders = parseKml(xml);
  const totalPoints = folders.reduce((sum, f) => sum + f.points.length, 0);
  console.log(`อ่าน KMZ: ${folders.length} กลุ่ม / ${totalPoints} จุด`);
  if (folders.length === 0 || totalPoints === 0) {
    throw new Error("parse KML ไม่ได้ผลลัพธ์ — ยกเลิก ไม่เขียนข้อมูล");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const Pole =
    mongoose.models.StreetLightPole ||
    mongoose.model(
      "StreetLightPole",
      new mongoose.Schema({}, { strict: false, collection: "street_light_poles", timestamps: true })
    );

  // เลขต้นวิ่งต่อจากเลขสูงสุดใน DB (sort code แบบ string ได้ตัวสูงสุด เพราะเลขต้นไม่รีเซ็ต)
  const last = await Pole.findOne({ code: new RegExp(`^${PREFIX}-\\d{9}$`) })
    .sort({ code: -1 })
    .select("code")
    .lean();
  let running = last ? Number(last.code.slice(-5)) : 0;
  const yymm = buddhistYearMonth();

  let inserted = 0;
  let skipped = 0;
  for (const folder of folders) {
    for (const pt of folder.points) {
      const key = { source: "kmz-import", group: folder.group, name: pt.name };
      const exists = await Pole.findOne(key).select("_id").lean();
      if (exists) {
        skipped += 1;
        continue;
      }
      running += 1;
      if (!dryRun) {
        await Pole.create({
          ...key,
          code: `${PREFIX}-${yymm}${String(running).padStart(5, "0")}`,
          lat: pt.lat,
          lng: pt.lng,
          lampType: "unknown",
          status: "unknown",
          photoUrl: "",
          note: "",
          lastSurveyedAt: null,
          lastSurveyedBy: "",
          surveys: [],
        });
      }
      inserted += 1;
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}เพิ่มใหม่ ${inserted} ต้น | ข้าม (มีอยู่แล้ว) ${skipped} ต้น`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: รัน dry-run ตรวจตัวเลข**

Run: `node --env-file=.env.local scripts/import-street-light-kmz.js --dry-run`
Expected: `อ่าน KMZ: 21 กลุ่ม / 1067 จุด` และ `[dry-run] เพิ่มใหม่ 1067 ต้น | ข้าม (มีอยู่แล้ว) 0 ต้น`

- [ ] **Step 3: รันจริง**

Run: `node --env-file=.env.local scripts/import-street-light-kmz.js`
Expected: `เพิ่มใหม่ 1067 ต้น | ข้าม (มีอยู่แล้ว) 0 ต้น`

- [ ] **Step 4: รันซ้ำพิสูจน์ idempotent**

Run: `node --env-file=.env.local scripts/import-street-light-kmz.js`
Expected: `เพิ่มใหม่ 0 ต้น | ข้าม (มีอยู่แล้ว) 1067 ต้น`

- [ ] **Step 5: spot-check ข้อมูลใน DB**

Run:
```bash
node --env-file=.env.local -e '
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection("street_light_poles");
  console.log("total:", await col.countDocuments());
  const first = await col.find().sort({ code: 1 }).limit(1).toArray();
  const lastDoc = await col.find().sort({ code: -1 }).limit(1).toArray();
  console.log("first:", first[0].code, "| last:", lastDoc[0].code);
  console.log("groups:", (await col.distinct("group")).length);
  await mongoose.disconnect();
})();
'
```
Expected: `total: 1067`, first ลงท้าย `00001`, last ลงท้าย `01067`, `groups: 21`

- [ ] **Step 6: commit (script + ไฟล์ข้อมูลดิบ)**

```bash
git add scripts/import-street-light-kmz.js public/point_of_ligth/
git commit -m "feat(smart-light): seed script นำเข้าเสาไฟ 1,067 ต้นจาก KMZ (idempotent)"
```

---

### Task 7: SmartLightMap — แผนที่เรนเดอร์ 2 ระดับตามซูม

**Files:**
- Create: `components/smart-light/SmartLightMap.js`

Component นี้ต้องถูก import ผ่าน `dynamic(..., { ssr: false })` เท่านั้น (leaflet ใช้ window)

**Props:**
- `poles` — array เสา (หลังกรอง filter แล้ว) `{_id, code, group, lat, lng, status, ...}`
- `groups` — array จาก `/api/smart-light/groups` `{group, total, byStatus, centroid}`
- `focusTarget` — `{lat, lng, zoom, key}` หรือ `null` — เปลี่ยนค่าแล้วแผนที่ fly ไป (`key` = ค่า unique กันซ้ำ เช่น `Date.now()`)
- `selectedPoleId` — `_id` เสาที่เลือก (วาดวงเน้น)
- `addMode` — boolean; เมื่อ true คลิกแผนที่ = เลือกตำแหน่งเสาใหม่
- `pickedLatLng` — `{lat, lng}` หรือ `null` — หมุดร่าง (ลากได้) ตอน addMode
- `onPickLocation(latlng)` — callback เมื่อคลิกเลือก/ลากตำแหน่งใน addMode
- `onSelectPole(pole)` — callback เมื่อแตะหมุดเสา

- [ ] **Step 1: สร้าง `components/smart-light/SmartLightMap.js`**

```jsx
// แผนที่เสาไฟ — เรนเดอร์ 2 ระดับตามซูม: ไกล = bubble รายกลุ่ม, ใกล้ = หมุดรายต้นเฉพาะในกรอบจอ
// ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  POLE_STATUS,
  POLE_ZOOM_THRESHOLD,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/smart-light/constants";

// ป้องกัน marker icon หายในบางระบบ (pattern เดียวกับ MapPoints ของ smart-school)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

// ติดตาม zoom + bounds ปัจจุบัน ส่งขึ้นไปให้ตัดสินใจว่าจะวาดระดับไหน
function ViewTracker({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() }),
  });
  useEffect(() => {
    onChange({ zoom: map.getZoom(), bounds: map.getBounds() });
  }, [map, onChange]);
  return null;
}

// fly ไปตำแหน่งเมื่อ focusTarget เปลี่ยน (key กันการ fly ซ้ำ)
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom || 17);
  }, [map, target]);
  return null;
}

// จับคลิกแผนที่ตอนโหมดเพิ่มเสา
function AddModeClick({ active, onPick }) {
  useMapEvents({
    click: (e) => {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function groupBubbleIcon(total) {
  const size = Math.max(36, Math.min(64, 26 + Math.sqrt(total) * 3));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:rgba(37,99,235,.85);border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3);">${total}</div>`,
    className: "smart-light-bubble",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function SmartLightMap({
  poles,
  groups,
  focusTarget,
  selectedPoleId,
  addMode,
  pickedLatLng,
  onPickLocation,
  onSelectPole,
}) {
  const [view, setView] = useState(null);

  const showPoles = view && view.zoom >= POLE_ZOOM_THRESHOLD;

  // ซูมใกล้: วาดเฉพาะเสาในกรอบจอ + ขอบเผื่อ 20% — จอหนึ่งเห็นจริงไม่กี่ร้อยต้น
  const visiblePoles = useMemo(() => {
    if (!showPoles) return [];
    const padded = view.bounds.pad(0.2);
    return poles.filter((p) => padded.contains([p.lat, p.lng]));
  }, [poles, view, showPoles]);

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      preferCanvas
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      <ViewTracker onChange={setView} />
      <FlyTo target={focusTarget} />
      <AddModeClick active={addMode} onPick={onPickLocation} />

      {/* ซูมไกล: bubble รายกลุ่ม แตะแล้วซูมเข้า */}
      {!showPoles &&
        groups.map((g) => (
          <GroupBubble key={g.group} group={g} />
        ))}

      {/* ซูมใกล้: หมุดรายต้น สีตามสถานะ */}
      {showPoles &&
        visiblePoles.map((p) => (
          <CircleMarker
            key={p._id}
            center={[p.lat, p.lng]}
            radius={p._id === selectedPoleId ? 11 : 7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: (POLE_STATUS[p.status] || POLE_STATUS.unknown).color,
              fillOpacity: 0.95,
            }}
            eventHandlers={{ click: () => !addMode && onSelectPole(p) }}
          />
        ))}

      {/* หมุดร่างตอนเพิ่มเสา — ลากปรับตำแหน่งได้ */}
      {addMode && pickedLatLng && (
        <Marker
          position={[pickedLatLng.lat, pickedLatLng.lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              onPickLocation({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}

// bubble รายกลุ่ม (แยก component เพื่อใช้ useMap สำหรับซูมเข้า)
function GroupBubble({ group }) {
  const map = useMap();
  if (!group.centroid || !Number.isFinite(group.centroid.lat)) return null;
  return (
    <Marker
      position={[group.centroid.lat, group.centroid.lng]}
      icon={groupBubbleIcon(group.total)}
      eventHandlers={{
        click: () => map.flyTo([group.centroid.lat, group.centroid.lng], POLE_ZOOM_THRESHOLD),
      }}
    />
  );
}
```

- [ ] **Step 2: lint + commit**

```bash
npm run lint
git add components/smart-light/SmartLightMap.js
git commit -m "feat(smart-light): แผนที่เรนเดอร์ 2 ระดับตามซูม (bubble กลุ่ม/หมุดรายต้น)"
```

---

### Task 8: อัปโหลดรูป + Bottom-sheet รายเสา + Modal บันทึกสภาพ

**Files:**
- Create: `lib/smart-light/uploadImage.js`
- Create: `components/smart-light/PoleBottomSheet.js`
- Create: `components/smart-light/SurveyModal.js`

- [ ] **Step 1: สร้าง `lib/smart-light/uploadImage.js`** (Cloudinary unsigned upload — pattern เดียวกับ `pages/admin/index.jsx`)

```js
// อัปโหลดรูปเข้า Cloudinary (unsigned preset) — คืน secure_url
// โยน Error เมื่อไม่สำเร็จ ให้ผู้เรียกตัดสินใจ (flow สำรวจ: ถามผู้ใช้ว่าบันทึกต่อโดยไม่มีรูปไหม)
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  const data = await res.json();
  if (!data.secure_url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  return data.secure_url;
}
```

- [ ] **Step 2: สร้าง `components/smart-light/PoleBottomSheet.js`**

```jsx
// bottom-sheet รายละเอียดเสา — เปิดเมื่อแตะหมุด แสดงข้อมูลเต็ม + ประวัติสำรวจ
// มือถือ: modal ชิดล่าง / จอใหญ่: กลางจอ (DaisyUI modal-bottom sm:modal-middle)
import Image from "next/image";
import { POLE_STATUS, LAMP_TYPE } from "@/lib/smart-light/constants";
import { googleMapsDirectionsUrl } from "@/lib/smart-light/geo";

function formatThaiDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }) {
  const s = POLE_STATUS[status] || POLE_STATUS.unknown;
  return (
    <span
      className="badge text-white border-0"
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </span>
  );
}

export default function PoleBottomSheet({ pole, loading, onClose, onSurvey, onEdit }) {
  if (!pole) return null;
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box max-h-[85vh]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-lg">{pole.code}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
              <span className="badge badge-outline">🏘️ {pole.group}</span>
              <StatusBadge status={pole.status} />
              <span className="text-gray-500">
                {(LAMP_TYPE[pole.lampType] || LAMP_TYPE.unknown).label}
              </span>
            </div>
          </div>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>

        {pole.photoUrl && (
          <div className="mt-3">
            <Image
              src={pole.photoUrl}
              alt={`รูปเสา ${pole.code}`}
              width={640}
              height={360}
              className="rounded-lg w-full h-40 object-cover"
            />
          </div>
        )}

        <div className="mt-3 space-y-1 text-sm text-gray-600">
          {pole.note && <p>📝 {pole.note}</p>}
          <p>
            🕐 สำรวจล่าสุด: {formatThaiDateTime(pole.lastSurveyedAt)}
            {pole.lastSurveyedBy ? ` โดย ${pole.lastSurveyedBy}` : ""}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="btn btn-primary" onClick={() => onSurvey(pole)}>
            📋 บันทึกสภาพ
          </button>
          <button className="btn btn-ghost border border-gray-300" onClick={() => onEdit(pole)}>
            ✏️ แก้ไขข้อมูล
          </button>
          <a
            className="btn btn-outline btn-info"
            href={googleMapsDirectionsUrl(pole.lat, pole.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            🧭 นำทาง
          </a>
        </div>

        {/* ประวัติสำรวจ (โหลดเต็มจาก GET /poles/:id) */}
        <div className="mt-4">
          <p className="font-semibold text-sm mb-2">ประวัติการสำรวจ</p>
          {loading ? (
            <p className="text-sm text-gray-400">กำลังโหลด…</p>
          ) : !pole.surveys || pole.surveys.length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่มีประวัติสำรวจ</p>
          ) : (
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {[...pole.surveys].reverse().map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm border-b border-gray-100 pb-2">
                  <StatusBadge status={s.status} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{s.note || "-"}</p>
                    <p className="text-xs text-gray-400">
                      {formatThaiDateTime(s.surveyedAt)} · {s.surveyedBy || "-"}
                    </p>
                  </div>
                  {s.photoUrl && (
                    <a href={s.photoUrl} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={s.photoUrl}
                        alt="รูปสำรวจ"
                        width={48}
                        height={48}
                        className="rounded object-cover w-12 h-12"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
```

- [ ] **Step 3: สร้าง `components/smart-light/SurveyModal.js`**

```jsx
// modal บันทึกสภาพเสา — ออกแบบให้จบเร็วหน้างาน: ปุ่มสถานะใหญ่ + ถ่ายรูป + หมายเหตุ
// อัปโหลดรูปพังต้องไม่บล็อกงาน: ถามยืนยันแล้วบันทึกต่อโดยไม่มีรูปได้
import { useState } from "react";
import { POLE_STATUS, SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";

export default function SurveyModal({ pole, onClose, onSaved }) {
  const [status, setStatus] = useState(
    SURVEY_STATUS_VALUES.includes(pole.status) ? pole.status : "normal"
  );
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = "";
      if (file) {
        try {
          photoUrl = await uploadImage(file);
        } catch {
          const proceed = window.confirm(
            "อัปโหลดรูปไม่สำเร็จ — บันทึกสภาพต่อโดยไม่มีรูปหรือไม่?"
          );
          if (!proceed) {
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await fetch(`/api/smart-light/poles/${pole._id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, photoUrl, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box">
        <h3 className="font-bold text-lg">📋 บันทึกสภาพ — {pole.code}</h3>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {SURVEY_STATUS_VALUES.map((value) => (
            <button
              key={value}
              className={`btn h-16 text-white border-0 ${status === value ? "" : "opacity-40"}`}
              style={{ backgroundColor: POLE_STATUS[value].color }}
              onClick={() => setStatus(value)}
            >
              {POLE_STATUS[value].label}
            </button>
          ))}
        </div>

        <label className="form-control mt-4">
          <span className="label-text mb-1">รูปถ่าย (ถ่ายจากกล้องได้เลย)</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">หมายเหตุ</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น หลอดกระพริบ เสาเอียง"
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
```

- [ ] **Step 4: lint + commit**

```bash
npm run lint
git add lib/smart-light/uploadImage.js components/smart-light/PoleBottomSheet.js components/smart-light/SurveyModal.js
git commit -m "feat(smart-light): bottom-sheet รายเสา + modal บันทึกสภาพ + อัปโหลดรูป"
```

---

### Task 9: Modal แก้ไขเสา + เพิ่มเสา + เปลี่ยนชื่อกลุ่ม

**Files:**
- Create: `components/smart-light/EditPoleModal.js`
- Create: `components/smart-light/AddPoleModal.js`
- Create: `components/smart-light/GroupRenameModal.js`

- [ ] **Step 1: สร้าง `components/smart-light/EditPoleModal.js`** — มีแผนที่ย่อยลากหมุดปรับพิกัด → ต้องถูก import ผ่าน `dynamic(..., { ssr: false })` จากหน้า page

```jsx
// modal แก้ไขข้อมูลเสา + ลากหมุดปรับพิกัดบนแผนที่ย่อย + ลบเสา (confirm 2 ชั้น)
// มี leaflet ข้างใน — ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LAMP_TYPE } from "@/lib/smart-light/constants";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

export default function EditPoleModal({ pole, groupNames, onClose, onSaved, onDeleted }) {
  const [group, setGroup] = useState(pole.group);
  const [lampType, setLampType] = useState(pole.lampType || "unknown");
  const [name, setName] = useState(pole.name || "");
  const [note, setNote] = useState(pole.note || "");
  const [position, setPosition] = useState({ lat: pole.lat, lng: pole.lng });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group,
          lampType,
          name,
          note,
          lat: position.lat,
          lng: position.lng,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "ลบไม่สำเร็จ");
      onDeleted();
    } catch (e) {
      setError(e.message || "ลบไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">✏️ แก้ไขข้อมูล — {pole.code}</h3>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชุมชน/กลุ่ม</span>
          <input
            className="input input-bordered w-full"
            list="smart-light-group-names"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id="smart-light-group-names">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชนิดโคม</span>
          <select
            className="select select-bordered w-full"
            value={lampType}
            onChange={(e) => setLampType(e.target.value)}
          >
            {Object.entries(LAMP_TYPE).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชื่อ/เลขเดิม</span>
          <input
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">หมายเหตุ</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="mt-3">
          <span className="label-text">ตำแหน่ง (ลากหมุดเพื่อปรับ)</span>
          <div className="h-56 mt-1 rounded-lg overflow-hidden">
            <MapContainer
              center={[pole.lat, pole.lng]}
              zoom={18}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
              />
              <Marker
                position={[position.lat, position.lng]}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = e.target.getLatLng();
                    setPosition({ lat: ll.lat, lng: ll.lng });
                  },
                }}
              />
            </MapContainer>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </p>
        </div>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        {/* ลบเสา: confirm 2 ชั้น — กดครั้งแรกเปิดกล่องยืนยันแสดงรหัส/กลุ่ม กดปุ่มแดงอีกครั้งจึงลบจริง */}
        {confirmingDelete ? (
          <div className="alert alert-error mt-4 flex-col items-start">
            <p className="font-semibold">
              ยืนยันลบเสา {pole.code} (กลุ่ม {pole.group})? ลบแล้วกู้คืนไม่ได้
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-error" onClick={handleDelete} disabled={submitting}>
                ลบถาวร
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={submitting}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-outline btn-error btn-sm mt-4"
            onClick={() => setConfirmingDelete(true)}
          >
            🗑 ลบเสานี้
          </button>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `components/smart-light/AddPoleModal.js`** — ฟอร์มหลังเลือกตำแหน่งบนแผนที่หลักแล้ว (ไม่มี leaflet ในตัว)

```jsx
// ฟอร์มเพิ่มเสาใหม่ — เปิดหลังผู้ใช้เลือกตำแหน่งบนแผนที่หลัก (หรือใช้ GPS) แล้ว
import { useState } from "react";
import { LAMP_TYPE } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";

export default function AddPoleModal({ latLng, groupNames, onClose, onSaved }) {
  const [group, setGroup] = useState("");
  const [lampType, setLampType] = useState("led");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!group.trim()) {
      setError("กรุณาระบุชุมชน/กลุ่ม");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = "";
      if (file) {
        try {
          photoUrl = await uploadImage(file);
        } catch {
          const proceed = window.confirm(
            "อัปโหลดรูปไม่สำเร็จ — เพิ่มเสาต่อโดยไม่มีรูปหรือไม่?"
          );
          if (!proceed) {
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await fetch("/api/smart-light/poles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: latLng.lat,
          lng: latLng.lng,
          group: group.trim(),
          lampType,
          note,
          photoUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "เพิ่มเสาไม่สำเร็จ");
      onSaved(data.data);
    } catch (e) {
      setError(e.message || "เพิ่มเสาไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box">
        <h3 className="font-bold text-lg">➕ เพิ่มเสาไฟใหม่</h3>
        <p className="text-sm text-gray-500 mt-1">
          ตำแหน่ง: {latLng.lat.toFixed(6)}, {latLng.lng.toFixed(6)}
        </p>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชุมชน/กลุ่ม *</span>
          <input
            className="input input-bordered w-full"
            list="smart-light-add-group-names"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="เลือกจากรายการ หรือพิมพ์กลุ่มใหม่"
          />
          <datalist id="smart-light-add-group-names">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชนิดโคม</span>
          <select
            className="select select-bordered w-full"
            value={lampType}
            onChange={(e) => setLampType(e.target.value)}
          >
            {Object.entries(LAMP_TYPE).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">รูปถ่าย</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">หมายเหตุ</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "เพิ่มเสา"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
```

- [ ] **Step 3: สร้าง `components/smart-light/GroupRenameModal.js`**

```jsx
// modal จัดการกลุ่ม — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม (updateMany ฝั่ง server)
import { useState } from "react";

export default function GroupRenameModal({ groups, onClose, onRenamed }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRename = async () => {
    if (!from || !to.trim()) {
      setError("กรุณาเลือกกลุ่มเดิมและกรอกชื่อใหม่");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/smart-light/groups/rename", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: to.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "เปลี่ยนชื่อไม่สำเร็จ");
      onRenamed();
    } catch (e) {
      setError(e.message || "เปลี่ยนชื่อไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box">
        <h3 className="font-bold text-lg">🏘️ เปลี่ยนชื่อกลุ่ม/ชุมชน</h3>
        <p className="text-sm text-gray-500 mt-1">
          เปลี่ยนแล้วมีผลกับเสาทุกต้นในกลุ่ม (ไว้แก้ชื่อที่สะกดผิดจากไฟล์เดิม)
        </p>

        <label className="form-control mt-3">
          <span className="label-text mb-1">กลุ่มเดิม</span>
          <select
            className="select select-bordered w-full"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">— เลือกกลุ่ม —</option>
            {groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group} ({g.total} ต้น)
              </option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชื่อใหม่</span>
          <input
            className="input input-bordered w-full"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="เช่น ชุมชนตาคลี"
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleRename} disabled={submitting}>
            {submitting ? "กำลังเปลี่ยน…" : "เปลี่ยนชื่อ"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
```

- [ ] **Step 4: lint + commit**

```bash
npm run lint
git add components/smart-light/EditPoleModal.js components/smart-light/AddPoleModal.js components/smart-light/GroupRenameModal.js
git commit -m "feat(smart-light): modal แก้ไขเสา/เพิ่มเสา/เปลี่ยนชื่อกลุ่ม"
```

---

### Task 10: SearchPanel — ค้นหาจาก GPS/รหัสเสา + เสาใกล้เคียง

**Files:**
- Create: `components/smart-light/SearchPanel.js`

- [ ] **Step 1: สร้าง `components/smart-light/SearchPanel.js`**

```jsx
// ช่องค้นหาช่องเดียว ตรวจรูปแบบอัตโนมัติ:
// - "lat,lng" หรือปุ่มใช้ตำแหน่งปัจจุบัน → 10 เสาใกล้สุดเรียงตามระยะ (haversine ฝั่ง client)
// - ข้อความอื่น → ค้นจากรหัสเสา (บางส่วนได้) และชื่อกลุ่ม
import { useMemo, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { haversineMeters, googleMapsDirectionsUrl, parseLatLng } from "@/lib/smart-light/geo";

const MAX_RESULTS = 10;

export default function SearchPanel({ poles, onFocusPole }) {
  const [query, setQuery] = useState("");
  const [gpsPoint, setGpsPoint] = useState(null); // จุดอ้างอิงจากปุ่ม "ตำแหน่งปัจจุบัน"
  const [gpsError, setGpsError] = useState("");

  const useCurrentLocation = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("อุปกรณ์นี้ไม่รองรับ GPS — พิมพ์พิกัดเองได้");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setGpsPoint({ lat: latitude, lng: longitude });
      },
      () => setGpsError("อ่านตำแหน่งไม่ได้ — เปิดสิทธิ์ GPS หรือพิมพ์พิกัด/แตะแผนที่แทน")
    );
  };

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return { mode: null, items: [] };

    const point = parseLatLng(q) || gpsPoint;
    if (parseLatLng(q)) {
      // โหมดพิกัด: เสาใกล้สุด 10 อันดับ
      const items = poles
        .map((p) => ({
          pole: p,
          distance: haversineMeters(point.lat, point.lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_RESULTS);
      return { mode: "gps", items };
    }

    // โหมดข้อความ: รหัสเสา (บางส่วน) หรือชื่อกลุ่ม
    const lower = q.toLowerCase();
    const items = poles
      .filter(
        (p) =>
          p.code.toLowerCase().includes(lower) ||
          (p.group || "").toLowerCase().includes(lower)
      )
      .slice(0, MAX_RESULTS)
      .map((p) => ({ pole: p, distance: null }));
    return { mode: "text", items };
  }, [query, gpsPoint, poles]);

  const formatDistance = (m) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          className="input input-bordered input-sm flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิกัด 15.22,100.36 หรือรหัสเสา/ชื่อกลุ่ม"
        />
        <button className="btn btn-sm btn-outline" onClick={useCurrentLocation}>
          📍 ตำแหน่งปัจจุบัน
        </button>
      </div>
      {gpsError && <p className="text-error text-xs mt-1">{gpsError}</p>}

      {results.items.length > 0 && (
        <ul className="menu bg-base-100 rounded-box shadow mt-1 max-h-64 overflow-y-auto flex-nowrap w-full">
          {results.items.map(({ pole, distance }) => (
            <li key={pole._id}>
              <div
                className="flex items-center gap-2 py-2"
                onClick={() => onFocusPole(pole)}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: (POLE_STATUS[pole.status] || POLE_STATUS.unknown).color,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pole.code}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {pole.group}
                    {distance !== null ? ` · ห่าง ${formatDistance(distance)}` : ""}
                  </p>
                </div>
                <a
                  className="btn btn-xs btn-outline btn-info shrink-0"
                  href={googleMapsDirectionsUrl(pole.lat, pole.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  🧭 นำทาง
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.items.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">ไม่พบเสาที่ตรงกับคำค้น</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: lint + commit**

```bash
npm run lint
git add components/smart-light/SearchPanel.js
git commit -m "feat(smart-light): ค้นหาเสาจากพิกัด GPS/รหัส + เสาใกล้เคียง + ปุ่มนำทาง"
```

---

### Task 11: หน้า `/admin/smart-light` — ประกอบทุกส่วน

**Files:**
- Create: `pages/admin/smart-light.jsx`

- [ ] **Step 1: สร้าง `pages/admin/smart-light.jsx`**

```jsx
// หน้าเสาไฟสาธารณะ (กองช่าง) — แผนที่ทะเบียนเสา + สำรวจ/แก้ไข/เพิ่ม/จัดกลุ่ม
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import PoleBottomSheet from "@/components/smart-light/PoleBottomSheet";
import SurveyModal from "@/components/smart-light/SurveyModal";
import AddPoleModal from "@/components/smart-light/AddPoleModal";
import GroupRenameModal from "@/components/smart-light/GroupRenameModal";
import SearchPanel from "@/components/smart-light/SearchPanel";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const SmartLightMap = dynamic(() => import("@/components/smart-light/SmartLightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400">
      กำลังโหลดแผนที่…
    </div>
  ),
});
const EditPoleModal = dynamic(() => import("@/components/smart-light/EditPoleModal"), {
  ssr: false,
});

export default function SmartLightPage() {
  const [poles, setPoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedPole, setSelectedPole] = useState(null); // ข้อมูลเต็ม (รวม surveys)
  const [sheetLoading, setSheetLoading] = useState(false);
  const [surveyPole, setSurveyPole] = useState(null);
  const [editPole, setEditPole] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [pickedLatLng, setPickedLatLng] = useState(null);
  const [addFormOpen, setAddFormOpen] = useState(false);

  const [focusTarget, setFocusTarget] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoadError("");
      const [polesRes, groupsRes] = await Promise.all([
        fetch("/api/smart-light/poles").then((r) => r.json()),
        fetch("/api/smart-light/groups").then((r) => r.json()),
      ]);
      if (!polesRes.success) throw new Error(polesRes.message);
      if (!groupsRes.success) throw new Error(groupsRes.message);
      setPoles(polesRes.data);
      setGroups(groupsRes.data);
    } catch (e) {
      setLoadError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const groupNames = useMemo(() => groups.map((g) => g.group), [groups]);

  const filteredPoles = useMemo(() => {
    return poles.filter(
      (p) =>
        (filterGroup === "all" || p.group === filterGroup) &&
        (filterStatus === "all" || p.status === filterStatus)
    );
  }, [poles, filterGroup, filterStatus]);

  // chips สรุปตาม filter กลุ่มปัจจุบัน (สถานะนับจากเสาที่ผ่าน filter กลุ่ม)
  const summary = useMemo(() => {
    const inGroup = poles.filter((p) => filterGroup === "all" || p.group === filterGroup);
    const count = (status) => inGroup.filter((p) => p.status === status).length;
    return {
      total: inGroup.length,
      normal: count("normal"),
      damaged: count("damaged"),
      off: count("off"),
      unknown: count("unknown"),
    };
  }, [poles, filterGroup]);

  // แตะหมุด → โหลดข้อมูลเต็ม (รวมประวัติ) แล้วเปิด bottom-sheet
  const openPole = useCallback(async (pole) => {
    setSelectedPole(pole);
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`);
      const data = await res.json();
      if (data.success) setSelectedPole(data.data);
    } finally {
      setSheetLoading(false);
    }
  }, []);

  const focusPole = useCallback(
    (pole) => {
      setFocusTarget({ lat: pole.lat, lng: pole.lng, zoom: 18, key: Date.now() });
      openPole(pole);
    },
    [openPole]
  );

  const refreshAndClose = useCallback(async () => {
    setSurveyPole(null);
    setEditPole(null);
    setSelectedPole(null);
    setRenameOpen(false);
    setAddFormOpen(false);
    setAddMode(false);
    setPickedLatLng(null);
    await loadAll();
  }, [loadAll]);

  // เพิ่มเสา: ใช้ GPS ปัจจุบันแทนการแตะแผนที่
  const pickCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์นี้ไม่รองรับ GPS — แตะเลือกจุดบนแผนที่แทน");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickedLatLng(ll);
        setFocusTarget({ ...ll, zoom: 18, key: Date.now() });
      },
      () => alert("อ่านตำแหน่งไม่ได้ — เปิดสิทธิ์ GPS หรือแตะเลือกจุดบนแผนที่แทน")
    );
  };

  return (
    <PermissionGuard>
      <main className="h-screen flex flex-col bg-gray-50">
        {/* แถบหัว + ค้นหา + กรอง */}
        <div className="bg-white border-b border-gray-200 p-3 space-y-2 z-10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="font-bold text-gray-900">💡 เสาไฟสาธารณะ (กองช่าง)</h1>
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setRenameOpen(true)}
              >
                🏘️ จัดการกลุ่ม
              </button>
              {addMode ? (
                <button
                  className="btn btn-sm btn-error"
                  onClick={() => {
                    setAddMode(false);
                    setPickedLatLng(null);
                  }}
                >
                  ✕ ยกเลิกเพิ่มเสา
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setAddMode(true);
                    setSelectedPole(null);
                  }}
                >
                  ➕ เพิ่มเสา
                </button>
              )}
            </div>
          </div>

          {addMode && (
            <div className="alert alert-info py-2 text-sm flex-wrap">
              <span>แตะจุดบนแผนที่เพื่อวางเสาใหม่ หรือ</span>
              <button className="btn btn-xs btn-outline" onClick={pickCurrentLocation}>
                📍 ใช้ตำแหน่งปัจจุบัน
              </button>
              {pickedLatLng && (
                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => setAddFormOpen(true)}
                >
                  ✓ ยืนยันตำแหน่งนี้ กรอกข้อมูล
                </button>
              )}
            </div>
          )}

          <SearchPanel poles={poles} onFocusPole={focusPole} />

          <div className="flex gap-2 items-center flex-wrap">
            <select
              className="select select-bordered select-sm"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="all">ทุกกลุ่ม ({poles.length})</option>
              {groups.map((g) => (
                <option key={g.group} value={g.group}>
                  {g.group} ({g.total})
                </option>
              ))}
            </select>

            {/* chips สรุป + กรองสถานะ (แตะเพื่อกรอง แตะซ้ำเพื่อยกเลิก) */}
            <button
              className={`badge badge-lg cursor-pointer ${filterStatus === "all" ? "badge-neutral" : "badge-ghost"}`}
              onClick={() => setFilterStatus("all")}
            >
              รวม {summary.total}
            </button>
            {Object.entries(POLE_STATUS).map(([value, s]) => (
              <button
                key={value}
                className="badge badge-lg cursor-pointer text-white border-0"
                style={{
                  backgroundColor: s.color,
                  opacity: filterStatus === "all" || filterStatus === value ? 1 : 0.35,
                }}
                onClick={() => setFilterStatus(filterStatus === value ? "all" : value)}
              >
                {s.label} {summary[value]}
              </button>
            ))}
          </div>

          {loadError && (
            <div className="alert alert-error py-2 text-sm">
              {loadError}
              <button className="btn btn-xs" onClick={loadAll}>ลองใหม่</button>
            </div>
          )}
        </div>

        {/* แผนที่เต็มพื้นที่ที่เหลือ */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              กำลังโหลดข้อมูลเสาไฟ…
            </div>
          ) : (
            <SmartLightMap
              poles={filteredPoles}
              groups={groups.filter(
                (g) => filterGroup === "all" || g.group === filterGroup
              )}
              focusTarget={focusTarget}
              selectedPoleId={selectedPole?._id || null}
              addMode={addMode}
              pickedLatLng={pickedLatLng}
              onPickLocation={setPickedLatLng}
              onSelectPole={openPole}
            />
          )}
        </div>

        {/* modals */}
        {selectedPole && !surveyPole && !editPole && (
          <PoleBottomSheet
            pole={selectedPole}
            loading={sheetLoading}
            onClose={() => setSelectedPole(null)}
            onSurvey={(p) => setSurveyPole(p)}
            onEdit={(p) => setEditPole(p)}
          />
        )}
        {surveyPole && (
          <SurveyModal
            pole={surveyPole}
            onClose={() => setSurveyPole(null)}
            onSaved={refreshAndClose}
          />
        )}
        {editPole && (
          <EditPoleModal
            pole={editPole}
            groupNames={groupNames}
            onClose={() => setEditPole(null)}
            onSaved={refreshAndClose}
            onDeleted={refreshAndClose}
          />
        )}
        {addFormOpen && pickedLatLng && (
          <AddPoleModal
            latLng={pickedLatLng}
            groupNames={groupNames}
            onClose={() => setAddFormOpen(false)}
            onSaved={refreshAndClose}
          />
        )}
        {renameOpen && (
          <GroupRenameModal
            groups={groups}
            onClose={() => setRenameOpen(false)}
            onRenamed={refreshAndClose}
          />
        )}
      </main>
    </PermissionGuard>
  );
}
```

- [ ] **Step 2: ยืนยันว่า `next/image` ใช้รูป Cloudinary ได้** — ตรวจแล้ว: `next.config.ts` มี `images.domains` รวม `res.cloudinary.com` อยู่แล้ว ไม่ต้องแก้อะไร (step นี้แค่กันพลาด: `grep res.cloudinary.com next.config.ts` ต้องเจอ)

- [ ] **Step 3: verify ใน browser (login superadmin)**

1. เปิด http://localhost:3000/admin/smart-light
2. เห็น bubble รายกลุ่ม (ซูมเริ่มต้น 13 < threshold 15) — แตะ bubble → ซูมเข้าเห็นหมุดรายต้น
3. แตะหมุด → bottom-sheet เปิด แสดงรหัส `TK-LED-…` + ปุ่มนำทาง/บันทึกสภาพ/แก้ไข
4. ทดสอบบันทึกสภาพ 1 ต้น → สีหมุดเปลี่ยน + chips อัปเดต
5. ทดสอบค้นหา: พิมพ์ `15.223, 100.363` → เห็นรายการเสาใกล้เคียงพร้อมระยะ

- [ ] **Step 4: lint + commit**

```bash
npm run lint
git add pages/admin/smart-light.jsx
git commit -m "feat(smart-light): หน้าแผนที่ /admin/smart-light ครบทุก flow"
```

---

### Task 12: ลงทะเบียนสิทธิ์ครบ 4 จุด + grant script

**Files:**
- Modify: `lib/permissions.ts` (2 จุด: `ALL_PAGES` + `DEFAULT_PERMISSIONS.admin`)
- Modify: `components/LayoutAdmin.tsx` (`navigationItems`)
- Create: `scripts/grant-smart-light-permission.js`

- [ ] **Step 1: เพิ่มใน `ALL_PAGES`** (`lib/permissions.ts`) — วางต่อจาก block ของ `/admin/smart-papar/water-quality` (บรรทัด ~81)

```ts
  {
    path: '/admin/smart-light',
    label: 'เสาไฟสาธารณะ',
    icon: '💡',
    description: 'ทะเบียน+สำรวจเสาไฟสาธารณะ LED บนแผนที่ (กองช่าง)',
    category: 'management'
  },
```

- [ ] **Step 2: เพิ่มใน `DEFAULT_PERMISSIONS.admin`** (ไฟล์เดียวกัน บรรทัด ~192) — spec กำหนดให้ role admin เห็นโดย default

```ts
  admin: [
    '/admin/dashboard',
    '/admin/my-tasks',
    '/admin/notifications',
    '/admin/smart-light',
    '/user/satisfaction',
  ],
```

- [ ] **Step 3: เพิ่มเมนูใน `components/LayoutAdmin.tsx`** — วางใน `navigationItems` group `'จัดการ'` ต่อจากบรรทัด `คุณภาพน้ำ (ประปา)` (บรรทัด ~31)

```ts
  { label: 'เสาไฟสาธารณะ',     href: '/admin/smart-light',               icon: '💡', group: 'จัดการ' },
```

- [ ] **Step 4: สร้าง `scripts/grant-smart-light-permission.js`** (ตามแบบ `grant-elderly-school-permission.js`)

```js
// One-time migration: ให้สิทธิ์หน้าเสาไฟสาธารณะกับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: user ที่ถูกกำหนด allowedPages เอง (ไม่ว่าง) จะไม่เห็นหน้าใหม่
// จนกว่าจะถูกเพิ่มสิทธิ์ (user ที่ allowedPages ว่างใช้ DEFAULT_PERMISSIONS ซึ่งอัปเดตแล้ว)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-light-permission.js            (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-smart-light-permission.js --yes      (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/smart-light";

async function main() {
  const confirmed = process.argv.includes("--yes");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const User =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema(
        {
          name: String,
          clerkId: String,
          role: String,
          allowedPages: { type: [String], default: [] },
        },
        { strict: false }
      ),
      "users"
    );

  // เป้าหมาย: user ที่มี custom allowedPages (ไม่ว่าง) และยังไม่มีหน้าเสาไฟ
  const filter = {
    "allowedPages.0": { $exists: true },
    allowedPages: { $ne: NEW_PAGE },
  };
  const targets = await User.find(filter)
    .select("name clerkId role allowedPages")
    .lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      clerkId: u.clerkId,
      role: u.role,
      pages: (u.allowedPages || []).length,
    }))
  );

  if (!confirmed) {
    console.log("โหมดแสดงรายชื่อ — ตรวจรายชื่อแล้วรันซ้ำพร้อม --yes เพื่อเพิ่มสิทธิ์จริง");
  } else {
    const res = await User.updateMany(filter, {
      $addToSet: { allowedPages: NEW_PAGE },
    });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: รัน dry-run ดูรายชื่อ (ยังไม่ --yes)**

Run: `node --env-file=.env.local scripts/grant-smart-light-permission.js`
Expected: ตารางรายชื่อ user ที่มี custom allowedPages — **แสดงผลให้ผู้ใช้ตัดสินใจเองว่าจะรัน `--yes` ตอนไหน** (อย่ารัน --yes โดยไม่ถาม เพราะเปิดสิทธิ์ให้ทุกคนที่มี custom pages)

- [ ] **Step 6: verify เมนู + lint + commit**

1. เปิดหน้า `/admin/dashboard` (login superadmin) → sidebar เห็นเมนู "เสาไฟสาธารณะ" ใน group จัดการ → คลิกแล้วไปหน้าแผนที่ได้
2. ```bash
   npm run lint
   git add lib/permissions.ts components/LayoutAdmin.tsx scripts/grant-smart-light-permission.js
   git commit -m "feat(smart-light): ลงทะเบียนสิทธิ์+เมนู ครบ 4 จุดตาม checklist"
   ```

---

### Task 13: เอกสารโมดูล + อัปเดต CLAUDE.md

**Files:**
- Create: `docs/modules/smart-light.md`
- Modify: `docs/modules/README.md` (เพิ่มบรรทัดดัชนี)
- Modify: `CLAUDE.md` (เพิ่ม bullet ใน Feature modules)

- [ ] **Step 1: สร้าง `docs/modules/smart-light.md`**

```markdown
# smart-light — เสาไฟสาธารณะ (กองช่าง)

ทะเบียนเสาไฟสาธารณะ LED บนแผนที่ + บันทึกสภาพจากการสำรวจหน้างาน
Spec: `docs/superpowers/specs/2026-07-10-smart-light-design.md`

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้า admin | `pages/admin/smart-light.jsx` |
| API | `pages/api/smart-light/` (`poles/`, `groups/`, `_auth.js`) |
| Components | `components/smart-light/` (SmartLightMap, PoleBottomSheet, SurveyModal, EditPoleModal, AddPoleModal, GroupRenameModal, SearchPanel) |
| Lib | `lib/smart-light/` (constants, geo, poleCode, uploadImage) |
| Model | `models/smart-light/StreetLightPole.js` → collection `street_light_poles` |
| Scripts | `scripts/import-street-light-kmz.js`, `scripts/grant-smart-light-permission.js` |
| ข้อมูลดิบ | `public/point_of_ligth/` (KMZ 1,067 จุด/21 กลุ่ม + KML 4 ไฟล์ — backup ห้ามลบ) |

## รหัสเสา

`TK-LED-ปปดด#####` เช่น `TK-LED-690700001` = ลงทะเบียนปี พ.ศ. 69 เดือน 07 ต้นที่ 00001
เลขต้น 5 หลักวิ่งต่อเนื่องทั้งระบบ **ไม่รีเซ็ตตามเดือน** — gen ที่ `lib/smart-light/poleCode.js`

## API (ทุกตัวผ่าน `requireSmartLightAdmin` — Clerk + appId + allowedPages `/admin/smart-light`)

- `GET/POST /api/smart-light/poles` — list (ไม่มี surveys) / เพิ่มเสา
- `GET/PUT/DELETE /api/smart-light/poles/:id` — เต็ม (รวมประวัติ) / แก้ / ลบ
- `POST /api/smart-light/poles/:id/survey` — บันทึกสภาพ (push surveys + อัปเดตสถานะปัจจุบัน)
- `GET /api/smart-light/groups` — สรุปรายกลุ่ม + centroid
- `PUT /api/smart-light/groups/rename` — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม

## แผนที่เรนเดอร์ 2 ระดับ

zoom < 15 → bubble รายกลุ่ม (centroid จาก API groups) · zoom ≥ 15 → หมุดรายต้นเฉพาะในกรอบจอ+ขอบเผื่อ 20%
threshold ปรับที่ `POLE_ZOOM_THRESHOLD` ใน `lib/smart-light/constants.js`

## Manual test checklist

1. seed: `node --env-file=.env.local scripts/import-street-light-kmz.js` → 1,067 จุด/21 กลุ่ม รหัสต่อเนื่อง; รันซ้ำไม่เพิ่ม
2. กรองกลุ่ม/สถานะ + chips ถูกต้อง
3. ซูมไกลเห็น bubble กลุ่ม / ซูมใกล้เห็นหมุดรายต้น เลื่อนลื่น
4. บันทึกสภาพ (มี/ไม่มีรูป) → สีหมุดเปลี่ยน ประวัติเพิ่ม
5. เพิ่มเสา (แตะแผนที่ + GPS) → รหัสต่อจากเลขสูงสุด; แก้ไข; ลากย้ายพิกัด; ลบ (confirm 2 ชั้น)
6. ค้นหา: วางพิกัด → 10 เสาใกล้สุด+ระยะ; พิมพ์รหัส/กลุ่ม → เจอ; ปุ่มนำทางเปิด Google Maps
7. เปลี่ยนชื่อกลุ่ม → เสาทุกต้นในกลุ่มอัปเดต
8. user ไม่มีสิทธิ์ → หน้า+API ปฏิเสธ; superadmin เข้าได้
9. มือถือ: bottom-sheet, ถ่ายรูป, geolocation

## นอกขอบเขต (เฟสถัดไป)

ใบสั่งซ่อม · หน้า public · อัปโหลด KML/KMZ ผ่านเว็บ · จุดไม่ซ้ำ ~22 จุดจาก KML 4 ไฟล์ · ฟิลด์งานช่างละเอียด (วัตต์/ความสูง/มิเตอร์)
```

- [ ] **Step 2: เพิ่มดัชนีใน `docs/modules/README.md`** — เปิดไฟล์ดูรูปแบบรายการเดิมก่อน แล้วเพิ่มบรรทัดตามรูปแบบเดียวกัน:

```markdown
- [smart-light](smart-light.md) — เสาไฟสาธารณะ (กองช่าง): ทะเบียน+สำรวจเสาไฟ LED บนแผนที่
```

- [ ] **Step 3: เพิ่ม bullet ใน `CLAUDE.md`** — ใน section "Feature modules" ต่อจาก bullet ของ Smart School:

```markdown
- **Smart Light / เสาไฟสาธารณะ (กองช่าง)** — โมดูล `smart-light`: ทะเบียนเสาไฟ LED 1,067 ต้น + บันทึกสภาพสำรวจ, model `models/smart-light/StreetLightPole.js` (collection `street_light_poles`, ประวัติสำรวจ embedded), API `pages/api/smart-light/*`, หน้า `/admin/smart-light` (แผนที่ Leaflet เรนเดอร์ 2 ระดับตามซูม), รหัสเสา `TK-LED-ปปดด#####` เลขต้นวิ่งต่อเนื่อง, seed จาก KMZ ใน `public/point_of_ligth/` ด้วย `scripts/import-street-light-kmz.js`
```

- [ ] **Step 4: commit**

```bash
git add docs/modules/smart-light.md docs/modules/README.md CLAUDE.md
git commit -m "docs(smart-light): เอกสารโมดูล + ดัชนี + CLAUDE.md"
```

---

### Task 14: Final verification

- [ ] **Step 1: lint ทั้งโปรเจกต์**

Run: `npm run lint`
Expected: ผ่าน (warning เดิมของ repo ที่ไม่เกี่ยวกับไฟล์ smart-light ไม่นับ)

- [ ] **Step 2: production build**

Run: `npm run build`
Expected: build สำเร็จ เห็น route `/admin/smart-light` และ `/api/smart-light/*` ใน output

- [ ] **Step 3: ไล่ manual checklist ใน `docs/modules/smart-light.md` ให้ครบทั้ง 9 ข้อ** (dev server + login superadmin; ข้อมือถือทดสอบผ่าน responsive mode ได้ แต่แจ้งผู้ใช้ให้ลองเครื่องจริงด้วย)

- [ ] **Step 4: ตรวจว่าไม่มีไฟล์หลงเหลือนอก convention**

Run: `git status --short`
Expected: ว่าง (ยกเว้น `.agents/`, `AGENTS.md` ที่ไม่เกี่ยวกับงานนี้ — ห้าม commit)

- [ ] **Step 5: สรุปผลให้ผู้ใช้** — รายงานสิ่งที่ verify แล้ว/ยังไม่ได้ verify (เช่น ทดสอบมือถือเครื่องจริง, การรัน grant script --yes ที่รอผู้ใช้ตัดสินใจ) แล้วใช้ skill `superpowers:finishing-a-development-branch` เพื่อเลือก merge/PR

---

## Success criteria (จาก spec)

- [ ] เสา 1,067 ต้น / 21 กลุ่มจาก KMZ อยู่ใน DB รหัส `TK-LED-6907xxxxx` ต่อเนื่อง — seed รันซ้ำได้ไม่ซ้ำ
- [ ] แผนที่: bubble กลุ่ม ↔ หมุดรายต้นตามซูม, สีตามสถานะ, กรองกลุ่ม/สถานะ, chips สรุป
- [ ] บันทึกสภาพ + รูป Cloudinary + ประวัติ; อัปโหลดพังไม่บล็อกงาน
- [ ] เพิ่ม (แตะแผนที่/GPS) แก้ไข (รวมลากพิกัด) ลบ (confirm 2 ชั้น) เปลี่ยนชื่อกลุ่ม
- [ ] ค้นหาพิกัด → 10 เสาใกล้สุด + ระยะ + นำทาง; ค้นหารหัส/กลุ่มได้
- [ ] สิทธิ์ครบ 4 จุด + grant script (dry-run ให้ผู้ใช้ตัดสินใจก่อนรันจริง)
- [ ] `npm run lint` + `npm run build` ผ่าน
