// รัน: node --env-file=.env.local scripts/grant-m10-permission.js
const mongoose = require("mongoose");
const OLD = ["/admin/m10-ingest", "/admin/m10-review", "/admin/m10-records"];
const NEW = "/admin/m10";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection("users");
  const appId = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
  await User.updateMany(
    { appId, allowedPages: { $exists: true, $ne: [] } },
    { $pull: { allowedPages: { $in: OLD } } }
  );
  const res = await User.updateMany(
    { appId, allowedPages: { $exists: true, $ne: [] } },
    { $addToSet: { allowedPages: NEW } }
  );
  console.log("migrated users:", res.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
