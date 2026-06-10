// Diagnostic (อ่านอย่างเดียว): แสดง role + allowedPages ของ user ทุกคน
// ใช้ตรวจว่าใครเห็นหน้าไหนเพราะอะไร — โดยเฉพาะเคส allowedPages ว่าง (= default ทุกหน้า)
// และเคสมี "/admin" ใน allowedPages (= prefix match ทุกหน้า /admin/*)
//
// วิธีรัน: node --env-file=.env.local scripts/list-user-permissions.js

const mongoose = require("mongoose");

async function main() {
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
          appId: String,
          allowedPages: { type: [String], default: [] },
        },
        { strict: false }
      ),
      "users"
    );

  const users = await User.find({})
    .select("name clerkId role appId allowedPages")
    .lean();

  for (const u of users) {
    const pages = u.allowedPages || [];
    console.log(`\n👤 ${u.name}  (role: ${u.role}, appId: ${u.appId})`);
    if (pages.length === 0) {
      console.log("   allowedPages: (ว่าง) → ใช้ default = เข้าได้ทุกหน้า");
    } else {
      for (const p of pages) {
        const grantsAll = p === "/admin" ? "  ⚠️ prefix match → เปิดทุกหน้า /admin/*" : "";
        console.log(`   - ${p}${grantsAll}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
