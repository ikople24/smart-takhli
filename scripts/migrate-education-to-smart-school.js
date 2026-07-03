// One-time migration: educationregisters (238 รายการ ปีงบ 2568)
//   → school_applicants + school_applications
//
// - ไม่แตะ collection เดิม (เก็บเป็น backup ถาวร)
// - idempotent: ยึด legacyId — รันซ้ำจะข้ามรายการที่ย้ายแล้ว
// - applicationId ใช้ TKC-xxx เดิม (เจ้าหน้าที่คุ้นเลขนี้) ถ้าซ้ำกันเองต่อท้าย -dupN
//
// วิธีรัน:
//   node --env-file=.env.local scripts/migrate-education-to-smart-school.js --dry-run
//   node --env-file=.env.local scripts/migrate-education-to-smart-school.js

const mongoose = require("mongoose");

const LEGACY_YEAR = 2568; // ข้อมูลเดิมสร้าง ก.ค.–ส.ค. 2025 = ปีงบ 2568

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const oldDocs = await db
    .collection("educationregisters")
    .find({})
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`พบข้อมูลเดิม ${oldDocs.length} รายการ`);

  const usedAppIds = new Set(
    (await db.collection("school_applications").find({}, { projection: { applicationId: 1 } }).toArray()).map(
      (d) => d.applicationId
    )
  );

  let created = 0;
  let skipped = 0;
  const samples = [];

  for (const doc of oldDocs) {
    const already = await db.collection("school_applicants").findOne({ legacyId: doc._id });
    if (already) {
      skipped++;
      continue;
    }

    const baseAppId = doc.applicantId || `TKC68-${String(created + 1).padStart(3, "0")}`;
    let applicationId = baseAppId;
    let n = 2;
    while (usedAppIds.has(applicationId)) applicationId = `${baseAppId}-dup${n++}`;
    usedAppIds.add(applicationId);

    const now = new Date();
    const applicant = {
      // จงใจไม่ใส่ฟิลด์ citizenId เลย — unique sparse index จะได้ไม่ชนกัน
      prefix: doc.prefix || "",
      name: doc.name || "(ไม่มีชื่อ)",
      phone: doc.phone || "",
      legacyApplicantId: doc.applicantId || null,
      legacyId: doc._id,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };
    const application = {
      surveyYear: LEGACY_YEAR,
      applicationId,
      educationLevel: doc.educationLevel || "",
      schoolName: doc.schoolName || "",
      gradeLevel: doc.gradeLevel || "",
      gpa: typeof doc.gpa === "number" ? doc.gpa : null,
      address: doc.address || "",
      actualAddress: doc.actualAddress || "",
      housingStatus: doc.housingStatus || "ไม่ระบุ",
      householdMembers: doc.householdMembers || 1,
      annualIncome: doc.annualIncome || 0,
      incomeSource: doc.incomeSource || [],
      familyStatus: doc.familyStatus || [],
      receivedScholarship: doc.receivedScholarship || [],
      takhliScholarshipHistory: doc.takhliScholarshipHistory || [],
      note: doc.note || "",
      imageUrl: Array.isArray(doc.imageUrl) ? doc.imageUrl.slice(0, 3) : [],
      location: doc.location || null,
      status: "ตรวจสอบแล้ว", // ข้อมูลปีเก่าถือว่าผ่านกระบวนการแล้ว
      statusUpdatedBy: "migration",
      statusUpdatedAt: now,
      isRenewal: false,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };

    if (samples.length < 3) samples.push({ applicant, application });

    if (!dryRun) {
      const { insertedId } = await db.collection("school_applicants").insertOne(applicant);
      await db.collection("school_applications").insertOne({ ...application, applicantRef: insertedId });
    }
    created++;
  }

  console.log(`สร้างใหม่ ${created} / ข้ามที่ย้ายแล้ว ${skipped}${dryRun ? " (--dry-run ยังไม่เขียนจริง)" : ""}`);
  console.log("ตัวอย่าง 3 รายการแรก:", JSON.stringify(samples, null, 2).slice(0, 2000));

  if (!dryRun) {
    const a = await db.collection("school_applicants").countDocuments();
    const b = await db.collection("school_applications").countDocuments({ surveyYear: LEGACY_YEAR });
    console.log(`ยอดหลัง migrate: applicants=${a}, applications(${LEGACY_YEAR})=${b} (ต้อง ≥ ${oldDocs.length})`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
