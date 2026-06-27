// รัน: node --env-file=.env.local scripts/grant-m10-permission.js
const mongoose = require("mongoose");
const PAGES = ["/admin/m10-ingest", "/admin/m10-review", "/admin/m10-records"];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection("users");
  // เพิ่มสิทธิ์ให้ user ที่มี custom allowedPages อยู่แล้ว (allowedPages ไม่ว่าง) เท่านั้น
  const res = await User.updateMany(
    { appId: process.env.NEXT_PUBLIC_APP_ID || "smart-takhli", allowedPages: { $exists: true, $ne: [] } },
    { $addToSet: { allowedPages: { $each: PAGES } } }
  );
  console.log("matched:", res.matchedCount, "modified:", res.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
