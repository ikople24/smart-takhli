// One-time migration: ให้สิทธิ์หน้าทะเบียนท่อประปากับ user เดิมที่มี custom allowedPages
//
// หมายเหตุ: หน้านี้ไม่อยู่ใน DEFAULT_PERMISSIONS (เครื่องมือเฉพาะกองการประปา)
// — script นี้เพิ่มสิทธิ์ให้ "ทุก" user ที่มี custom allowedPages ถ้าต้องการให้เฉพาะบางคน
// ให้ superadmin ติ๊กรายคนที่ /admin/superadmin แทน
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-water-permission.js            (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-smart-water-permission.js --yes      (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/smart-water";

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

  // role clause: ตัดบัญชี role `user` ออก เพราะ /admin/smart-water เป็นหน้าแอดมิน และ
  // การเติม path ลง allowedPages ของ user ธรรมดาเท่ากับเปิดหน้าแอดมิน
  // ให้ non-admin (custom allowedPages override ค่า default ของ role)
  const filter = {
    role: { $in: ["admin", "superadmin"] },
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
