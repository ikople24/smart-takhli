// scripts/grant-garbage-permission.js
// เพิ่มสิทธิ์หน้า /admin/garbage ให้ user ที่มี allowedPages กำหนดเองไว้แล้ว
// (user ที่ allowedPages ว่าง = ใช้ค่า default จึงเห็นหน้าใหม่อยู่แล้ว ไม่ต้องแก้)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-garbage-permission.js         (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-garbage-permission.js --yes   (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet
// ถ้าต้องการให้เฉพาะบางคน: ไม่ต้องรัน script — ให้ superadmin ติ๊กรายคนที่ /admin/superadmin
//
// ข้อควรรู้: filter อิงสิทธิ์ /admin/smart-waste เป็นตัวชี้ "กลุ่มงานสาธารณสุข" ตามเจตนา
// แต่ ณ 2026-08-13 มี user เพียง 1 รายที่มีสิทธิ์นั้น (จาก 23 รายที่มี allowedPages กำหนดเอง)
// เพราะ scripts/grant-smart-waste-permission.js ยังไม่ถูกรันด้วย --yes
// → ถ้าต้องการให้กว้างกว่านี้ ให้รัน grant-smart-waste-permission.js --yes ก่อน
//   หรือติ๊กสิทธิ์รายคนที่ /admin/superadmin

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/garbage";

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

  // เป้าหมาย: คนที่เคยติ๊กสิทธิ์เอง (allowedPages ไม่ว่าง) — ใช้หน้าขยะที่มีอยู่เป็นตัวชี้กลุ่มงานสาธารณสุข
  const filter = { allowedPages: "/admin/smart-waste" };
  const targets = await User.find(filter).select("name clerkId role allowedPages").lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      clerkId: u.clerkId,
      role: u.role,
      pages: (u.allowedPages || []).length,
      hasGarbage: (u.allowedPages || []).includes(NEW_PAGE),
    }))
  );

  if (!confirmed) {
    console.log("--dry-run: ยังไม่แก้ไขข้อมูล (ใส่ --yes เพื่อเพิ่มสิทธิ์จริง)");
  } else {
    const res = await User.updateMany(filter, { $addToSet: { allowedPages: NEW_PAGE } });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
