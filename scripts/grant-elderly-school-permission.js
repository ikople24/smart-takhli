// One-time migration: ให้สิทธิ์หน้าโรงเรียนผู้สูงอายุกับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: หน้า /admin/elderly-school ถูกแยกออกจาก /admin/smart-health
// แต่ _app.tsx ตรวจสิทธิ์รายหน้าจาก allowedPages ใน Mongo — user ที่เคยถูกกำหนด
// allowedPages เอง (ไม่ว่าง) จะมองไม่เห็น UI โรงเรียนผู้สูงอายุที่เคยใช้ได้
// (user ที่ allowedPages ว่างใช้ DEFAULT_PERMISSIONS ซึ่งอัปเดตแล้ว — ไม่ต้องทำอะไร)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-elderly-school-permission.js --dry-run
//   node --env-file=.env.local scripts/grant-elderly-school-permission.js
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGES = [
  "/admin/elderly-school",
  "/admin/elderly-cards",
  "/admin/elderly-schedule",
];

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

  // เงื่อนไข allowedPages: "/admin/smart-health" คัดเฉพาะ user ที่มี custom
  // allowedPages (ไม่ว่าง) และเคยเข้าถึง smart-health ซึ่งรวม UI ผู้สูงอายุเดิม
  const filter = { allowedPages: "/admin/smart-health" };
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
      hasElderlySchool: (u.allowedPages || []).includes("/admin/elderly-school"),
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
