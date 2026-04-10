import dbConnect from "@/lib/dbConnect";
import EmployeePerson from "@/models/EmployeePerson";
import EmployeeHealthRecord from "@/models/EmployeeHealthRecord";
import { fetchSheetCSVByGid, summarizeEmployeeHealthTable } from "@/lib/employeeHealthDashboard";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

function getBangkokISODate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseSheetId(sheetUrl) {
  try {
    const u = new URL(String(sheetUrl));
    const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    // Superadmin-only guard (prevents duplicate sync by other users)
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = clerkUser?.publicMetadata?.role || "";
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Forbidden: superadmin only" });
    }

    const { sheetUrl, gids, deptLabels, measurementDate } = req.body || {};
    const url = String(sheetUrl || "").trim();
    if (!url) return res.status(400).json({ success: false, message: "Missing sheetUrl" });

    const gidArr = String(gids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!gidArr.length) return res.status(400).json({ success: false, message: "Missing gids" });

    const labelArr = String(deptLabels || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    // Require full department mapping to avoid "gid=0" leftovers
    if (labelArr.length !== gidArr.length) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกชื่อแผนกให้ครบทุก gid (จำนวนชื่อแผนกต้องเท่ากับจำนวน gid)",
        details: {
          gidsCount: gidArr.length,
          deptLabelsCount: labelArr.length,
          gids: gidArr,
          deptLabels: labelArr,
        },
      });
    }

    const dateISO = String(measurementDate || "").trim() || getBangkokISODate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ success: false, message: "Invalid measurementDate (YYYY-MM-DD)" });
    }

    const sheetId = parseSheetId(url);

    await dbConnect();

    const totals = {
      departments: {},
      peopleUpserted: 0,
      recordsUpserted: 0,
      recordsUpdated: 0,
      peopleMerged: 0,
      recordsMerged: 0,
      rowsFetched: 0,
    };

    for (let i = 0; i < gidArr.length; i++) {
      const gid = gidArr[i];
      const dept = labelArr[i];
      const oldDept = `gid=${gid}`;

      // Migration/cleanup:
      // If previous sync used fallback department "gid=..." we merge/move those people+records into the real department.
      const oldPeople = await EmployeePerson.find({ department: oldDept }).lean();
      for (const op of oldPeople || []) {
        const fullName = String(op?.fullName || "").trim();
        if (!fullName) continue;

        const target = await EmployeePerson.findOne({ fullName, department: dept }).lean();
        if (!target) {
          // Safe to just rename department on person (keeps same personId => avoids duplicates)
          await EmployeePerson.updateOne({ _id: op._id }, { $set: { department: dept } });
          await EmployeeHealthRecord.updateMany({ personId: op._id }, { $set: { department: dept } });
          totals.peopleMerged += 1;
          continue;
        }

        // Merge: move records from old personId to target personId (by measurementDate)
        const oldRecords = await EmployeeHealthRecord.find({ personId: op._id }).lean();
        for (const r of oldRecords || []) {
          const patch = { ...r };
          delete patch._id;
          delete patch.__v;
          patch.personId = target._id;
          patch.department = dept;

          await EmployeeHealthRecord.updateOne(
            { personId: target._id, measurementDate: r.measurementDate },
            { $set: patch },
            { upsert: true }
          );
          totals.recordsMerged += 1;
        }
        await EmployeeHealthRecord.deleteMany({ personId: op._id });
        await EmployeePerson.deleteOne({ _id: op._id });
        totals.peopleMerged += 1;
      }

      const table = await fetchSheetCSVByGid(url, gid, { timeoutMs: 20000 });
      totals.rowsFetched += Array.isArray(table?.rows) ? table.rows.length : 0;
      const summary = summarizeEmployeeHealthTable(table, { countMode: "rows", sheetKey: String(gid) });
      const people = Array.isArray(summary?.people) ? summary.people : [];

      if (!totals.departments[dept]) {
        totals.departments[dept] = { gid, peopleUpserted: 0, recordsUpserted: 0, recordsUpdated: 0, rows: people.length };
      } else {
        totals.departments[dept].rows += people.length;
      }

      for (const p of people) {
        const fullName = String(p?.name || "").trim();
        if (!fullName) continue;

        const personRes = await EmployeePerson.findOneAndUpdate(
          { fullName, department: dept },
          { $set: { fullName, department: dept, source: "sheet" } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        totals.peopleUpserted += 1;
        totals.departments[dept].peopleUpserted += 1;

        const recordDoc = {
          personId: personRes._id,
          department: dept,
          measurementDate: dateISO,
          measuredAt: new Date(),
          weightKg: typeof p?.weightKg === "number" ? p.weightKg : null,
          heightCm: typeof p?.heightCm === "number" ? p.heightCm : null,
          sys: typeof p?.bp?.systolic === "number" ? p.bp.systolic : null,
          dia: typeof p?.bp?.diastolic === "number" ? p.bp.diastolic : null,
          sugarMgDl: typeof p?.sugarMgDl === "number" ? p.sugarMgDl : null,
          source: {
            sheetId,
            gid: String(gid),
            rowIndex: typeof p?.rowIndex === "number" ? p.rowIndex : null,
            sheetUrl: url,
            csvUrl: table?.csvUrl || null,
          },
        };

        const existing = await EmployeeHealthRecord.findOne({ personId: personRes._id, measurementDate: dateISO }).lean();
        if (existing) {
          await EmployeeHealthRecord.updateOne({ _id: existing._id }, { $set: recordDoc });
          totals.recordsUpdated += 1;
          totals.departments[dept].recordsUpdated += 1;
        } else {
          await EmployeeHealthRecord.create(recordDoc);
          totals.recordsUpserted += 1;
          totals.departments[dept].recordsUpserted += 1;
        }
      }

      // Backfill: if previous sync used fallback "gid=..." update records for this gid to the real department
      await EmployeeHealthRecord.updateMany(
        {
          "source.sheetId": sheetId,
          "source.gid": String(gid),
          department: { $regex: /^gid=/ },
        },
        { $set: { department: dept } }
      );
    }

    return res.status(200).json({ success: true, measurementDate: dateISO, totals });
  } catch (e) {
    console.error("employee health sync error:", e);
    return res.status(500).json({
      success: false,
      message: e?.message || "Server error",
      hint:
        "ถ้าเห็นว่า sheet ไม่ public: ไปที่ Google Sheet → Share → ตั้งค่า Anyone with the link (Viewer) และ/หรือ File → Share → Publish to the web",
    });
  }
}

