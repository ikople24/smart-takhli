# เพิ่ม auth ให้ API elderly-school (ฝั่ง admin) — Design

**วันที่:** 2026-06-19
**Roadmap:** เฟส 7 (ส่วน security) ใน [docs/modules/README.md](../../modules/README.md)
**ประเภท:** Security fix (ปิดช่องโหว่ API ที่เปิดโล่ง)

## ปัญหา

API `/api/elderly-school/*` ทั้ง 9 ไฟล์ **ไม่มี auth เลย** — ใครก็ยิงได้ ทั้งที่เป็นข้อมูล
ผู้สูงอายุ (ชื่อ-เลขบัตร-สุขภาพ-จิตเวช) ที่อ่อนไหวตาม PDPA. โค้ดถูกย้ายมาแบบ verbatim
ตอนแยกโมดูล (เฟส 1) จึงยังไม่มีการตรวจสิทธิ์

## เป้าหมาย

กั้น endpoint ฝั่ง admin ด้วยรูปแบบ auth มาตรฐานของระบบ โดย **ไม่กระทบ** flow
public self-checkin (QR พิมพ์แจกแล้ว)

## การตัดสินใจที่ยืนยันแล้ว

1. **Public คงเดิม:** `checkin.js` เท่านั้น (หน้า `/elderly/checkin` เรียกตัวนี้ตัวเดียว) — ไม่แตะ
2. **กั้นทุก method รวม GET:** ข้อมูล PDPA → การอ่านก็ต้องมีสิทธิ์
3. **เกณฑ์สิทธิ์:** ใช้ page permission เดียว `/admin/elderly-school` กับทุก admin endpoint
   (โมดูลนี้สิทธิ์ถูกให้รวมกันทั้ง 3 หน้าตั้งแต่ migration เฟส 1)
4. **ใช้ `hasPermission` กลาง** (`@/lib/permissions`) ไม่เขียน inline เอง — เคารพกติกา
   "allowedPages ว่าง = ชุด DEFAULT ตาม role (ไม่ใช่ทุกหน้า)" และ exact/prefix match ที่เดียว

## สถาปัตยกรรม

### Helper ใหม่: `pages/api/elderly-school/_auth.js`

`requireElderlySchoolAdmin(req)` ตาม pattern `pages/api/pm25/_auth.js` + `activities/_auth.js`:

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/elderly-school";

// ⚠️ inline User schema (จำเป็นตาม pattern ปัจจุบัน — เฟส 6 จะรวมเป็นที่เดียว)
export async function requireElderlySchoolAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "Unauthorized" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") return { ok: true, userId, role, isSuperAdmin: true };

  await dbConnect();
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) return { ok: false, status: 403, message: "User not registered" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID)
    return { ok: false, status: 403, message: "No app access" };
  if (!hasPermission(mongoUser.role || role, mongoUser.allowedPages, REQUIRED_PAGE))
    return { ok: false, status: 403, message: "No page access" };

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false };
}
```

### Endpoint ที่กั้น (8 ไฟล์)

`cards`, `dashboard`, `import`, `people`, `schedule`, `visits`, `assessments`, `sheet-dashboard`

ใส่ guard เป็น **บรรทัดแรกภายใน `handler`** (ก่อน method check / dbConnect / งานอื่น):

```js
  const auth = await requireElderlySchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
```

> บางไฟล์มี helper function ก่อน `export default async function handler` — ต้องแทรกใน
> ตัว handler เท่านั้น ไม่ใช่บนสุดของไฟล์

### คงเดิม (public)

`checkin.js` — ไม่แตะ (public self-checkin)

## Error handling

- ไม่ login → 401 `Unauthorized`
- login แต่ไม่มีสิทธิ์ → 403 (`User not registered` / `No app access` / `No page access`)
- superadmin ลัดผ่าน

## การทดสอบ

โปรเจกต์ไม่มี test runner — ตรวจด้วย:
- `npm run build` + `npm run lint`
- dev + curl ไม่แนบ token:
  - `curl -s /api/elderly-school/people` → 401 (เดิมได้ข้อมูล)
  - ทำซ้ำกับทั้ง 8 endpoint → 401 ทุกตัว
  - `curl -s -X POST /api/elderly-school/checkin ...` → ยังทำงานปกติ (ไม่ใช่ 401)
- เปิดหน้า admin elderly-school ตอน login → ทุกอย่างทำงานเหมือนเดิม

## นอกขอบเขต

- `checkin.js` rate-limit / abuse protection (คนละเรื่อง)
- เฟส 7 ส่วนอื่น (API กำพร้า, dead code, shim) — แยกทำ
- เฟส 6 (รวม inline User schema) — helper นี้ยัง inline ตาม pattern ปัจจุบัน
