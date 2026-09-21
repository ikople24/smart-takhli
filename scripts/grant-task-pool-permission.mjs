// One-time migration: ให้สิทธิ์หน้า /admin/task-pool กับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: หน้า "กองงานรอรับ" เป็นหน้าใหม่ (2026-09) คู่กับ /admin/my-tasks — user ที่ allowedPages ว่าง
// ใช้ DEFAULT_PERMISSIONS ซึ่งเพิ่มหน้านี้แล้ว แต่ user ที่เคยถูกตั้ง allowedPages เอง (ไม่ว่าง) จะโดน access-denied
// จนกว่า superadmin จะติ๊กให้ หรือรันสคริปต์นี้ — ให้กับทุกคนที่มีสิทธิ์ /admin/my-tasks อยู่แล้ว
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-task-pool-permission.mjs --dry-run
//   node --env-file=.env.local scripts/grant-task-pool-permission.mjs --yes
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

import mongoose from "mongoose";

const NEW_PAGES = ["/admin/task-pool"];
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

async function main() {
  const dryRun = !process.argv.includes("--yes");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const User =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema(
        { name: String, clerkId: String, role: String, appId: String, allowedPages: { type: [String], default: [] } },
        { strict: false }
      ),
      "users"
    );

  const filter = { appId: APP_ID, allowedPages: "/admin/my-tasks" };
  const targets = await User.find(filter).select("name clerkId role allowedPages").lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย (app ${APP_ID})`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      role: u.role,
      pages: (u.allowedPages || []).length,
      hasTaskPool: (u.allowedPages || []).includes("/admin/task-pool"),
    }))
  );

  if (dryRun) {
    console.log("dry-run: ยังไม่แก้ไขข้อมูล — ใส่ --yes เพื่อบันทึกจริง");
  } else {
    const res = await User.updateMany(filter, { $addToSet: { allowedPages: { $each: NEW_PAGES } } });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
