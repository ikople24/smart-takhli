// Backfill: เติม name (จาก Clerk) + appId ให้ Mongo user doc ที่ "ไม่มีชื่อ"
//
// ทำไมต้องมี: doc บางตัวถูกสร้างข้ามแอป (แชร์ collection `users` กัน) มาแบบไม่สมบูรณ์
// = มีแค่ role/clerkId ไม่มี name และไม่มี appId ทำให้:
//   - ถูกซ่อนจากหน้า /admin/superadmin (ตัวกรองเดิมทิ้ง user ที่ไม่มี name/department)
//   - เข้าแอปไม่ได้ (verify-app-access → no_app_assigned เพราะไม่มี appId)
//
// วิธีรัน (ต้องมี MONGO_URI + NEXT_PUBLIC_APP_ID + CLERK_SECRET_KEY ใน .env.local):
//   node --env-file=.env.local scripts/backfill-user-name-appid.js --dry-run
//   node --env-file=.env.local scripts/backfill-user-name-appid.js
//
// ตัวเลือก:
//   --app-id=<id>   override appId (ปกติอ่านจาก NEXT_PUBLIC_APP_ID — ของ deploy นี้คือ app_b)
//   --set-appid     เติม appId ให้ด้วย (ถ้าไม่ใส่ = เติมแค่ name ไม่ให้สิทธิ์เข้าแอป)
//
// รันซ้ำได้ (idempotent) — แตะเฉพาะ doc ที่ยังไม่มี name

const mongoose = require("mongoose");

async function clerkName(clerkId) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is not set");
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  const email = u.email_addresses?.[0]?.email_address || "";
  return { name: name || email, email };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const setAppId = process.argv.includes("--set-appid");
  const appId =
    (process.argv.find((a) => a.startsWith("--app-id=")) || "").split("=")[1] ||
    process.env.NEXT_PUBLIC_APP_ID;

  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  if (setAppId && !appId) throw new Error("ระบุ --app-id=<id> หรือ NEXT_PUBLIC_APP_ID เมื่อใช้ --set-appid");

  await mongoose.connect(process.env.MONGO_URI);
  const User =
    mongoose.models.User ||
    mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "users" }));

  const targets = await User.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  })
    .select("clerkId appId role")
    .lean();

  console.log(`พบ doc ที่ไม่มีชื่อ ${targets.length} ราย${setAppId ? ` (จะเติม appId=${appId} ด้วย)` : " (เติมแค่ name)"}\n`);

  for (const u of targets) {
    const info = u.clerkId ? await clerkName(u.clerkId) : null;
    const name = info?.name;
    if (!name) {
      console.log(`  ⚠️ ${u.clerkId}: หาชื่อใน Clerk ไม่ได้ — ข้าม`);
      continue;
    }
    const set = { name };
    if (setAppId && !u.appId) set.appId = appId;

    console.log(`  ${u.clerkId} → name="${name}"${set.appId ? `, appId=${set.appId}` : ""}${u.appId ? ` (appId เดิม: ${u.appId})` : ""}`);
    if (!dryRun) {
      await User.updateOne({ clerkId: u.clerkId }, { $set: set });
    }
  }

  console.log(dryRun ? "\n--dry-run: ยังไม่แก้ไขข้อมูล" : "\n✅ เสร็จ");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
