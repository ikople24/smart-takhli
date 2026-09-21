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
