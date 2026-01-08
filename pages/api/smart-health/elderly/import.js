import dbConnect from "@/lib/dbConnect";
import ElderlyPerson from "@/models/ElderlyPerson";
import ElderlyVisit from "@/models/ElderlyVisit";
import { fetchAndParseSheetCSV } from "@/lib/elderlySchoolDashboard";
import { parseSheetRowToPersonAndVisits } from "@/lib/elderlySchoolImport";

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

    // Upsert people
    const upsertOps = Array.from(peopleByCitizenId.values()).map((p) => ({
      updateOne: {
        filter: { citizenId: p.citizenId },
        update: {
          $set: {
            fullName: p.fullName,
            ageYears: p.ageYears ?? null,
            birthDateText: p.birthDateText ?? null,
            bloodType: p.bloodType ?? null,
            address: p.address ?? null,
            phone: p.phone ?? null,
            occupation: p.occupation ?? null,
            heightCm: p.heightCm ?? null,
            baselineWeightKg: p.baselineWeightKg ?? null,
            sourceYearFirstSeen: p.sourceYearFirstSeen ?? year,
          },
        },
        upsert: true,
      },
    }));

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

    // Upsert visits
    const visitOps = [];
    for (const [citizenId, visits] of visitsByCitizenId.entries()) {
      const personId = personIdByCitizenId.get(citizenId);
      if (!personId) continue;
      for (const v of visits) {
        visitOps.push({
          updateOne: {
            filter: { personId, yearBE: year, visitNo: v.visitNo },
            update: {
              $set: {
                heightCm: v.heightCm ?? null,
                weightKg: v.weightKg ?? null,
                waistCm: v.waistCm ?? null,
                pulseBpm: v.pulseBpm ?? null,
                bp1Sys: v.bp1Sys ?? null,
                bp1Dia: v.bp1Dia ?? null,
                bp2Sys: v.bp2Sys ?? null,
                bp2Dia: v.bp2Dia ?? null,
                source: `sheet${year}`,
              },
            },
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


