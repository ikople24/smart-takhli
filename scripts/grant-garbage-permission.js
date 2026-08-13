// scripts/grant-garbage-permission.js
// เพิ่มสิทธิ์หน้า /admin/garbage ให้ user ที่มี allowedPages กำหนดเองไว้แล้ว
// (user ที่ allowedPages ว่าง = ใช้ค่า default จึงเห็นหน้าใหม่อยู่แล้ว ไม่ต้องแก้)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-garbage-permission.js         (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-garbage-permission.js --yes   (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet และ filter ตัดคนที่มีสิทธิ์แล้วออก (รันซ้ำจะนับ 0 ราย)
// ถ้าต้องการให้เฉพาะบางคน: ไม่ต้องรัน script — ให้ superadmin ติ๊กรายคนที่ /admin/superadmin
//
// ทำไมต้องครอบ "ทุกคนที่ตั้งสิทธิ์เอง": /admin/garbage อยู่ใน DEFAULT_PERMISSIONS.admin แล้ว
// → admin ที่ allowedPages ว่างเห็นหน้านี้อยู่แล้วโดยอัตโนมัติ
// ถ้าไม่รันสคริปต์นี้ คนที่ superadmin ตั้งสิทธิ์ไว้ละเอียดจะกลับเห็นน้อยกว่าคนที่ไม่ได้ตั้งเลย
// ซึ่งกลับหัวกลับหางกับเจตนาของระบบสิทธิ์

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

  // เป้าหมาย: user ที่มี allowedPages ไม่ว่าง (= ถูกตั้งสิทธิ์เอง) และยังไม่มีหน้านี้
  // $exists กัน field หาย · $ne: [] กันอาเรย์ว่าง · $nin กันคนที่มีสิทธิ์แล้ว (ทำให้รันซ้ำนับ 0)
  const filter = {
    allowedPages: { $exists: true, $ne: [], $nin: [NEW_PAGE] },
  };
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
