// One-time migration: ให้สิทธิ์ /admin/smart-school กับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: หน้า /admin/education-map ถูกแทนด้วย /admin/smart-school
// user ที่มี custom allowedPages (ไม่ว่าง) จะมองไม่เห็นหน้าใหม่จนกว่าจะเพิ่มสิทธิ์
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-school-permission.js --dry-run
//   node --env-file=.env.local scripts/grant-smart-school-permission.js
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGES = ["/admin/smart-school"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
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

  // คัดเฉพาะ user ที่เคยเข้าถึงหน้า education-map เดิม
  const filter = { allowedPages: "/admin/education-map" };
  const targets = await User.find(filter)
    .select("name clerkId role allowedPages")
    .lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      role: u.role,
      pages: (u.allowedPages || []).length,
      hasSmartSchool: (u.allowedPages || []).includes("/admin/smart-school"),
    }))
  );

  if (dryRun) {
    console.log("--dry-run: ยังไม่แก้ไขข้อมูล");
  } else {
    const res = await User.updateMany(filter, {
      $addToSet: { allowedPages: { $each: NEW_PAGES } },
    });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
