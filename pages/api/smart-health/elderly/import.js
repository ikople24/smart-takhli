import dbConnect from "@/lib/dbConnect";
import ElderlyPerson from "@/models/ElderlyPerson";
import ElderlyVisit from "@/models/ElderlyVisit";
import { fetchAndParseSheetCSV } from "@/lib/elderlySchoolDashboard";
import { parseSheetRowToPersonAndVisits } from "@/lib/elderlySchoolImport";

function hasSheetString(v) {
  if (v === null || v === undefined) return false;
  return String(v).trim() !== "";
}

/** ผสมข้อมูลคน: ช่องว่างใน Sheet ไม่ทับค่าที่แก้ในระบบแล้ว */
function mergePersonFieldsFromSheet(incoming, existing, yearBE) {
  const ex = existing || null;
  const pick = (inc, prev) => (hasSheetString(inc) ? inc : prev ?? null);

  const firstYear = (() => {
    const a = ex?.sourceYearFirstSeen;
    if (a != null && Number.isFinite(a)) return Math.min(a, yearBE);
    return yearBE;
  })();

  return {
    fullName: pick(incoming.fullName, ex?.fullName) || incoming.fullName,
    ageYears: incoming.ageYears != null ? incoming.ageYears : ex?.ageYears ?? null,
    birthDateText: pick(incoming.birthDateText, ex?.birthDateText),
    bloodType: pick(incoming.bloodType, ex?.bloodType),
    address: pick(incoming.address, ex?.address),
    phone: pick(incoming.phone, ex?.phone),
    occupation: pick(incoming.occupation, ex?.occupation),
    heightCm: incoming.heightCm != null ? incoming.heightCm : ex?.heightCm ?? null,
    baselineWeightKg:
      incoming.baselineWeightKg != null ? incoming.baselineWeightKg : ex?.baselineWeightKg ?? null,
    sourceYearFirstSeen: firstYear,
  };
}

/** อัปเดต visit จาก Sheet เฉพาะฟิลด์ที่มีค่า — ไม่ล้างค่าที่กรอกใน dashboard/check-in */
function buildVisitSetNonDestructive(v, yearBE) {
  const set = {};
  if (v.heightCm != null) set.heightCm = v.heightCm;
  if (v.weightKg != null) set.weightKg = v.weightKg;
  if (v.waistCm != null) set.waistCm = v.waistCm;
  if (v.pulseBpm != null) set.pulseBpm = v.pulseBpm;
  if (v.bp1Sys != null) set.bp1Sys = v.bp1Sys;
  if (v.bp1Dia != null) set.bp1Dia = v.bp1Dia;
  if (v.bp2Sys != null) set.bp2Sys = v.bp2Sys;
  if (v.bp2Dia != null) set.bp2Dia = v.bp2Dia;
  if (Object.keys(set).length === 0) return null;
  set.source = `sheet${yearBE}`;
  return set;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { yearBE, csvUrl, dryRun } = req.body || {};

    const year = Number(yearBE);
    if (!Number.isFinite(year) || year < 2500 || year > 2700) {
      return res.status(400).json({ message: "Invalid yearBE (e.g. 2568)" });
    }

    if (!csvUrl || typeof csvUrl !== "string") {
      return res.status(400).json({ message: "Missing csvUrl" });
    }

    await dbConnect();

    const table = await fetchAndParseSheetCSV(csvUrl, { timeoutMs: 30000 });
    const headers = table.headers || [];
    const rows = table.rows || [];

    let peopleParsed = 0;
    let peopleSkipped = 0;
    let visitsParsed = 0;

    const preview = [];

    // For upsert, we do in two phases to avoid repeated queries:
    // - Collect unique citizenIds
    // - Upsert people
    // - Map citizenId => personId
    const peopleByCitizenId = new Map();
    const visitsByCitizenId = new Map();

    for (const row of rows) {
      const parsed = parseSheetRowToPersonAndVisits({ headers, row, yearBE: year });
      if (parsed.skip) {
        peopleSkipped++;
        continue;
      }
      peopleParsed++;
      visitsParsed += parsed.visits.length;

      peopleByCitizenId.set(parsed.person.citizenId, parsed.person);
      visitsByCitizenId.set(parsed.person.citizenId, parsed.visits);

      if (preview.length < 15) {
        preview.push({
          citizenId: parsed.person.citizenId,
          fullName: parsed.person.fullName,
          heightCm: parsed.person.heightCm,
          visitsCount: parsed.visits.length,
          latest: parsed.latest,
        });
      }
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        yearBE: year,
        totals: {
          rows: rows.length,
          peopleParsed,
          peopleSkipped,
          visitsParsed,
          uniquePeople: peopleByCitizenId.size,
        },
        preview,
      });
    }

    const citizenIdsForMerge = Array.from(peopleByCitizenId.keys());
    const existingPeople = await ElderlyPerson.find({
      citizenId: { $in: citizenIdsForMerge },
    }).lean();
    const existingByCitizenId = new Map(existingPeople.map((doc) => [doc.citizenId, doc]));

    // Upsert people (ช่องว่างใน Sheet ไม่ทับข้อมูลเดิมใน DB)
    const upsertOps = Array.from(peopleByCitizenId.values()).map((p) => {
      const merged = mergePersonFieldsFromSheet(p, existingByCitizenId.get(p.citizenId), year);
      return {
        updateOne: {
          filter: { citizenId: p.citizenId },
          update: {
            $set: {
              citizenId: p.citizenId,
              fullName: merged.fullName,
              ageYears: merged.ageYears ?? null,
              birthDateText: merged.birthDateText ?? null,
              bloodType: merged.bloodType ?? null,
              address: merged.address ?? null,
              phone: merged.phone ?? null,
              occupation: merged.occupation ?? null,
              heightCm: merged.heightCm ?? null,
              baselineWeightKg: merged.baselineWeightKg ?? null,
              sourceYearFirstSeen: merged.sourceYearFirstSeen ?? year,
            },
          },
          upsert: true,
        },
      };
    });

    if (upsertOps.length) {
      await ElderlyPerson.bulkWrite(upsertOps, { ordered: false });
    }

    // Get personIds
    const citizenIds = Array.from(peopleByCitizenId.keys());
    const persons = await ElderlyPerson.find(
      { citizenId: { $in: citizenIds } },
      { citizenId: 1 }
    ).lean();
    const personIdByCitizenId = new Map(persons.map((p) => [p.citizenId, p._id]));

    // Upsert visits — เฉพาะฟิลด์ที่ Sheet มีค่า (ไม่ล้างค่าที่บันทึกผ่านหน้าแอดมิน/check-in)
    const visitOps = [];
    for (const [citizenId, visits] of visitsByCitizenId.entries()) {
      const personId = personIdByCitizenId.get(citizenId);
      if (!personId) continue;
      for (const v of visits) {
        const $set = buildVisitSetNonDestructive(v, year);
        if (!$set) continue;
        visitOps.push({
          updateOne: {
            filter: { personId, yearBE: year, visitNo: v.visitNo },
            update: { $set },
            upsert: true,
          },
        });
      }
    }

    if (visitOps.length) {
      await ElderlyVisit.bulkWrite(visitOps, { ordered: false });
    }

    return res.status(200).json({
      success: true,
      dryRun: false,
      yearBE: year,
      totals: {
        rows: rows.length,
        peopleParsed,
        peopleSkipped,
        visitsParsed,
        uniquePeople: peopleByCitizenId.size,
        peopleUpserted: upsertOps.length,
        visitsUpserted: visitOps.length,
      },
      preview,
    });
  } catch (error) {
    console.error("elderly import error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Import failed",
    });
  }
}


