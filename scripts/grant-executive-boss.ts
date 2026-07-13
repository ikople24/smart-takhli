// สร้าง/อัปเดต Mongo user doc ให้ "ผู้บริหาร (boss)" — เห็นทุกโมดูลยกเว้นการตั้งค่า
//
// ทำไมต้องรัน: user ที่ได้สิทธิ์เข้าแอปผ่าน Clerk publicMetadata.allowedApps อย่างเดียว
// จะ "ไม่มี" document ใน Mongo collection `users` ทำให้:
//   1) verify-app-access คืน allowedPages ว่าง → เห็นแค่ชุด DEFAULT_PERMISSIONS.admin
//   2) API ของแต่ละโมดูล (_auth.js) ตอบ 403 "User not registered" เพราะหา mongoUser ไม่เจอ
//   3) ไม่โผล่ในรายการหน้า /admin/superadmin (ดึงจาก Mongo) → กำหนดสิทธิ์ผ่าน UI ไม่ได้
//
// หมายเหตุ: ปกติ onboard พนักงานใหม่ให้ใช้ปุ่ม "เพิ่มเข้าระบบ" ในหน้า /admin/superadmin
// script นี้ไว้สำหรับเคสที่อยากตั้งเป็น boss ให้เสร็จในครั้งเดียว (สร้าง doc + ใส่สิทธิ์ + ถอด superadmin)
//
// วิธีรัน (ต้องมี MONGO_URI + NEXT_PUBLIC_APP_ID ใน .env.local; --email ต้องมี CLERK_SECRET_KEY):
//   node --env-file=.env.local --import tsx scripts/grant-executive-boss.ts --email=boss@example.com --dry-run
//   node --env-file=.env.local --import tsx scripts/grant-executive-boss.ts --email=boss@example.com
//
// ตัวเลือกเพิ่มเติม:
//   --app-id=<id>            override appId (ปกติอ่านจาก NEXT_PUBLIC_APP_ID ซึ่งถูกอยู่แล้ว
//                            — อย่าใส่มั่ว! ต้องตรงกับ appId ของ user คนอื่นใน DB ไม่งั้นโมดูลจะ 403)
//   --set-clerk-role=admin   เปลี่ยน Clerk role ด้วย (เช่นถอด superadmin → admin) โดย "merge"
//                            metadata ผ่าน /v1/users/{id}/metadata เพื่อรักษา allowedApps ไว้
//
// รันซ้ำได้ (idempotent) — upsert ตาม clerkId
//
// รายการหน้าดึงจาก getExecutivePagePaths() ตรง ๆ (ไม่ hardcode) → เพิ่มหน้าโมดูลใหม่
// ใน ALL_PAGES เมื่อไร script นี้จะรวมให้เองอัตโนมัติ

import mongoose from "mongoose";
import { getExecutivePagePaths } from "../lib/permissions";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function clerkSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is not set");
  return secret;
}

// หา clerkId + ชื่อ + role จากอีเมล ผ่าน Clerk Backend API
async function resolveClerkUserByEmail(email: string) {
  const url = `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${clerkSecret()}` } });
  if (!res.ok) throw new Error(`Clerk API error ${res.status}: ${await res.text()}`);
  const users = await res.json();
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error(`ไม่พบผู้ใช้ใน Clerk ที่อีเมล ${email}`);
  }
  const u = users[0];
  return {
    clerkId: u.id as string,
    name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
    role: (u.public_metadata?.role as string) || "",
  };
}

async function getClerkUser(clerkId: string) {
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    headers: { Authorization: `Bearer ${clerkSecret()}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return {
    name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
    role: (u.public_metadata?.role as string) || "",
  };
}

// เปลี่ยน Clerk role โดย "merge" metadata (รักษา allowedApps และคีย์อื่นไว้)
// ใช้ PATCH /v1/users/{id}/metadata ซึ่ง deep-merge — ต่างจาก updateUser ที่ทับ publicMetadata ทั้ง object
async function setClerkRole(clerkId: string, role: string) {
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${clerkSecret()}`, "Content-Type": "application/json" },
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
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local --import tsx");
  }
  const appId = getArg("app-id") || process.env.NEXT_PUBLIC_APP_ID;
  if (!appId) {
    throw new Error("app id is not set — ระบุ --app-id=<id> หรือ NEXT_PUBLIC_APP_ID ใน .env.local");
  }
  if (!clerkId && !email) {
    throw new Error("ต้องระบุ --email=<อีเมล> หรือ --clerk-id=<clerkId> อย่างน้อยหนึ่งอย่าง");
  }

  let currentClerkRole = "";

  if (!clerkId && email) {
    const resolved = await resolveClerkUserByEmail(email);
    clerkId = resolved.clerkId;
    currentClerkRole = resolved.role;
    if (!name) name = resolved.name;
    console.log(
      `Clerk: อีเมล ${email} → clerkId ${clerkId}${name ? ` (${name})` : ""} | role ปัจจุบัน: ${currentClerkRole || "(ว่าง)"}`
    );
  } else if (clerkId) {
    const u = await getClerkUser(clerkId);
    if (u) {
      currentClerkRole = u.role;
      if (!name) name = u.name;
    }
  }

  const executivePages = getExecutivePagePaths();

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

  const existing: any = await User.findOne({ clerkId }).lean();
  console.log(
    existing
      ? `พบ doc เดิม: ${existing.name || "(ไม่มีชื่อ)"} | appId=${existing.appId || "(ว่าง)"} | allowedPages=${(existing.allowedPages || []).length} หน้า`
      : "ยังไม่มี doc ใน Mongo → จะสร้างใหม่"
  );

  // เตือนถ้า appId ไม่ตรงกับที่ user คนอื่นในระบบใช้ (สาเหตุคลาสสิกของ 403 No app access)
  const otherAppIds: string[] = await User.distinct("appId", { appId: { $nin: ["", null] } });
  if (otherAppIds.length > 0 && !otherAppIds.includes(appId)) {
    console.log(
      `\n⚠️  appId "${appId}" ไม่ตรงกับที่ user คนอื่นใช้ (${otherAppIds.join(", ")}) — โมดูลอาจตอบ 403`
    );
  }

  const set: Record<string, unknown> = {
    appId,
    role,
    allowedPages: executivePages,
    isActive: true,
    isArchived: false,
  };
  if (name) set.name = name;

  console.log("\nจะตั้งค่า (Mongo):");
  console.log(`  clerkId     : ${clerkId}`);
  console.log(`  name        : ${set.name || existing?.name || "(คงเดิม/ว่าง)"}`);
  console.log(`  appId       : ${appId}`);
  console.log(`  role        : ${role}`);
  console.log(`  allowedPages: ${executivePages.length} หน้า (ทุกโมดูลยกเว้นตั้งค่า)`);

  if (setClerkRoleTo) {
    console.log(
      `\nจะเปลี่ยน Clerk role (merge, รักษา allowedApps): ${currentClerkRole || "(ว่าง)"} → ${setClerkRoleTo}`
    );
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
      await setClerkRole(clerkId!, setClerkRoleTo);
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
