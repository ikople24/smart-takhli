// สร้าง/อัปเดต Mongo user doc ให้ "ผู้บริหาร (boss)" — เห็นทุกโมดูลยกเว้นการตั้งค่า
//
// ทำไมต้องรัน: boss ที่ได้สิทธิ์เข้าแอปผ่าน Clerk publicMetadata.allowedApps อย่างเดียว
// จะ "ไม่มี" document ใน Mongo collection `users` ทำให้:
//   1) verify-app-access คืน allowedPages ว่าง → เห็นแค่ชุด DEFAULT_PERMISSIONS.admin (4 หน้า)
//   2) API ของแต่ละโมดูล (_auth.js) ตอบ 403 "User not registered" เพราะหา mongoUser ไม่เจอ
//   3) ไม่โผล่ในรายการหน้า /admin/superadmin (ดึงจาก Mongo) → กำหนดสิทธิ์ผ่าน UI ไม่ได้
// script นี้สร้าง Mongo doc (ผูก clerkId + appId ปัจจุบัน) พร้อม allowedPages = preset ผู้บริหาร
// แก้ครบทั้ง 3 ข้อในครั้งเดียว หลังรันเสร็จ boss จะโผล่ในหน้า superadmin ให้ปรับทีหลังได้
//
// วิธีรัน (ต้องมี MONGO_URI + NEXT_PUBLIC_APP_ID ใน .env.local; --email ต้องมี CLERK_SECRET_KEY ด้วย):
//   node --env-file=.env.local scripts/grant-executive-boss.js --email=boss@example.com --dry-run
//   node --env-file=.env.local scripts/grant-executive-boss.js --email=boss@example.com
//   node --env-file=.env.local scripts/grant-executive-boss.js --clerk-id=user_xxx --name="ชื่อผู้บริหาร"
//
// ตัวเลือกเพิ่มเติม:
//   --app-id=smart-takhli       override appId (ปกติอ่านจาก NEXT_PUBLIC_APP_ID — ระบุเมื่อ .env เป็น app dev)
//   --set-clerk-role=admin      เปลี่ยน Clerk role ด้วย (เช่นถอด superadmin → admin) โดย "merge" metadata
//                               ผ่าน /v1/users/{id}/metadata เพื่อรักษา allowedApps ไว้ (ไม่ทับทั้ง object)
//
// รันซ้ำได้ (idempotent) — upsert ตาม clerkId
//
// EXECUTIVE_PAGES ต้องตรงกับ getExecutivePagePaths() ใน lib/permissions.ts
// (= ทุกหน้าที่ category !== 'settings' และไม่อยู่ใน EXECUTIVE_EXCLUDED_PATHS)
// ถ้าเพิ่มหน้าโมดูลใหม่ในหมวด management/reports/user อย่าลืมเพิ่มที่นี่ด้วย
const EXECUTIVE_PAGES = [
  "/admin/manage-complaints",
  "/admin/smart-health",
  "/admin/elderly-school",
  "/admin/elderly-schedule",
  "/admin/smart-school",
  "/admin/smart-papar/water-quality",
  "/admin/manage-activities",
  "/admin/elderly-cards",
  "/admin/dashboard",
  "/admin/feedback-analysis",
  "/admin/analytics",
  "/admin/my-tasks",
  "/admin/notifications",
  "/user/satisfaction",
];

const mongoose = require("mongoose");

function getArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

// หา clerkId + ชื่อ จากอีเมล ผ่าน Clerk Backend API (ต้องมี CLERK_SECRET_KEY)
async function resolveClerkUserByEmail(email) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error("CLERK_SECRET_KEY is not set — จำเป็นเมื่อใช้ --email (หรือใช้ --clerk-id แทน)");
  }
  const url = `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
  if (!res.ok) {
    throw new Error(`Clerk API error ${res.status}: ${await res.text()}`);
  }
  const users = await res.json();
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error(`ไม่พบผู้ใช้ใน Clerk ที่อีเมล ${email}`);
  }
  const u = users[0];
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return { clerkId: u.id, name, role: u.public_metadata?.role || "" };
}

// อ่านข้อมูล Clerk user จาก clerkId (ใช้ตอนไม่ได้มาจากอีเมล — เพื่อโชว์ role ปัจจุบัน)
async function getClerkUser(clerkId) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return { name: `${u.first_name || ""} ${u.last_name || ""}`.trim(), role: u.public_metadata?.role || "" };
}

// เปลี่ยน Clerk role โดย "merge" metadata (รักษา allowedApps และคีย์อื่นไว้)
// ใช้ PATCH /v1/users/{id}/metadata ซึ่ง deep-merge — ต่างจาก updateUser ที่ทับ publicMetadata ทั้ง object
async function setClerkRole(clerkId, role) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is not set — จำเป็นสำหรับ --set-clerk-role");
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ public_metadata: { role } }),
  });
  if (!res.ok) throw new Error(`Clerk metadata PATCH error ${res.status}: ${await res.text()}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const email = getArg("email");
  let clerkId = getArg("clerk-id");
  let name = getArg("name");
  const role = getArg("role") || "admin";
  const setClerkRoleTo = getArg("set-clerk-role"); // undefined = ไม่แตะ Clerk role

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  const appId = getArg("app-id") || process.env.NEXT_PUBLIC_APP_ID;
  if (!appId) {
    throw new Error("app id is not set — ระบุ --app-id=<id> หรือ NEXT_PUBLIC_APP_ID ใน .env.local");
  }
  if (!clerkId && !email) {
    throw new Error("ต้องระบุ --email=<อีเมล> หรือ --clerk-id=<clerkId> อย่างน้อยหนึ่งอย่าง");
  }

  // role ปัจจุบันใน Clerk (ไว้โชว์/ยืนยันตอนถอด superadmin)
  let currentClerkRole = "";

  // ถ้าให้มาแค่อีเมล → หา clerkId (และชื่อ ถ้ายังไม่ระบุ) จาก Clerk
  if (!clerkId && email) {
    const resolved = await resolveClerkUserByEmail(email);
    clerkId = resolved.clerkId;
    currentClerkRole = resolved.role;
    if (!name) name = resolved.name;
    console.log(`Clerk: อีเมล ${email} → clerkId ${clerkId}${name ? ` (${name})` : ""} | role ปัจจุบัน: ${currentClerkRole || "(ว่าง)"}`);
  } else if (clerkId) {
    const u = await getClerkUser(clerkId);
    if (u) {
      currentClerkRole = u.role;
      if (!name) name = u.name;
    }
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
          appId: { type: String, default: "" },
          allowedPages: { type: [String], default: [] },
          isActive: { type: Boolean, default: true },
          isArchived: { type: Boolean, default: false },
        },
        { collection: "users", timestamps: true, strict: false }
      )
    );

  const existing = await User.findOne({ clerkId }).lean();
  console.log(
    existing
      ? `พบ doc เดิม: ${existing.name || "(ไม่มีชื่อ)"} | appId=${existing.appId || "(ว่าง)"} | allowedPages=${(existing.allowedPages || []).length} หน้า`
      : "ยังไม่มี doc ใน Mongo → จะสร้างใหม่"
  );

  const set = {
    appId,
    role,
    allowedPages: EXECUTIVE_PAGES,
    isActive: true,
    isArchived: false,
  };
  if (name) set.name = name;

  console.log("\nจะตั้งค่า (Mongo):");
  console.log(`  clerkId     : ${clerkId}`);
  console.log(`  name        : ${set.name || existing?.name || "(คงเดิม/ว่าง)"}`);
  console.log(`  appId       : ${appId}`);
  console.log(`  role        : ${role}`);
  console.log(`  allowedPages: ${EXECUTIVE_PAGES.length} หน้า (ทุกโมดูลยกเว้นตั้งค่า)`);

  if (setClerkRoleTo) {
    console.log(`\nจะเปลี่ยน Clerk role (merge, รักษา allowedApps): ${currentClerkRole || "(ว่าง)"} → ${setClerkRoleTo}`);
    if (currentClerkRole === "superadmin" && setClerkRoleTo !== "superadmin") {
      console.log("  ⚠️ กำลังถอดสิทธิ์ superadmin — หลังเปลี่ยน boss จะถูกจำกัดตาม allowedPages");
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: ยังไม่แก้ไขข้อมูล");
  } else {
    await User.updateOne({ clerkId }, { $set: set }, { upsert: true });
    console.log("\n✅ Mongo: บันทึกแล้ว");
    if (setClerkRoleTo) {
      await setClerkRole(clerkId, setClerkRoleTo);
      console.log(`✅ Clerk: role → ${setClerkRoleTo} (allowedApps คงเดิม)`);
    }
    console.log("✅ เสร็จ — boss เข้าได้ทุกโมดูลยกเว้นตั้งค่า และจะโผล่ในหน้า /admin/superadmin");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
