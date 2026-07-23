import dbConnect from "@/lib/dbConnect";
import Pm25Latest from "@/models/Pm25Latest";
import Pm25DailySnapshot from "@/models/Pm25DailySnapshot";
import Pm25Monthly from "@/models/Pm25Monthly";
import Pm25SyncLog from "@/models/Pm25SyncLog";
import {
  fetchDustboyStationLatest,
  fetchDustboy30Day,
  fetchDustboy1Year,
  normalizeDustboyLatest,
  aggregateHourlyToDaily,
  aggregateHourlyToMonthly,
} from "@/lib/pm25Data";

export function getBangkokYMD(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getBangkokMonthKey(date = new Date()) {
  return getBangkokYMD(date).slice(0, 7);
}

async function writeSyncLog(job, success, message, meta = null) {
  try {
    await Pm25SyncLog.create({ job, success, message, meta });
  } catch (e) {
    console.error("pm25 sync log error:", e);
  }
}

export async function getPm25FromCache() {
  await dbConnect();
  const [latestDoc, dailyDoc, monthlyDocs] = await Promise.all([
    Pm25Latest.findOne({ key: "default" }).lean(),
    Pm25DailySnapshot.findOne({ key: "default" }).lean(),
    Pm25Monthly.find().sort({ monthKey: -1 }).limit(12).lean(),
  ]);

  if (!latestDoc?.latest?.pm25) return null;

  const monthlyAverages = [...monthlyDocs]
    .reverse()
    .map((m) => ({
      key: m.monthKey,
      month: m.month,
      year: m.year,
      name: m.name,
      fullName: m.fullName,
      avg: m.avg,
      count: m.count,
    }));

  return {
    source: latestDoc.source || "dustboy",
    latest: latestDoc.latest,
    dailyAverages: dailyDoc?.days || [],
    monthlyAverages,
    syncedAt: latestDoc.syncedAt,
    dailySyncedAt: dailyDoc?.syncedAt,
    monthlySyncedAt: monthlyDocs[0]?.syncedAt || null,
    stale: latestDoc.syncedAt
      ? Date.now() - new Date(latestDoc.syncedAt).getTime() > 2 * 60 * 60 * 1000
      : true,
  };
}

export async function syncPm25Hourly() {
  await dbConnect();
  try {
    const station = await fetchDustboyStationLatest();
    const latest = normalizeDustboyLatest(station);
    const logDatetime = String(station.log_datetime || "");

    await Pm25Latest.findOneAndUpdate(
      { key: "default" },
      {
        source: "dustboy",
        latest,
        logDatetime,
        syncedAt: new Date(),
        lastError: null,
      },
      { upsert: true, new: true }
    );

    await writeSyncLog("hourly", true, "OK", { pm25: latest.pm25, logDatetime });
    return { success: true, latest, syncedAt: new Date() };
  } catch (error) {
    const message = error?.message || String(error);
    await Pm25Latest.findOneAndUpdate(
      { key: "default" },
      { lastError: message },
      { upsert: true }
    );
    await writeSyncLog("hourly", false, message);
    return { success: false, message };
  }
}

export async function syncPm25Daily() {
  await dbConnect();
  try {
    const history = await fetchDustboy30Day();
    const days = aggregateHourlyToDaily(history?.value || []);

    await Pm25DailySnapshot.findOneAndUpdate(
      { key: "default" },
      { days, syncedAt: new Date(), lastError: null },
      { upsert: true, new: true }
    );

    await writeSyncLog("daily", true, "OK", { days: days.length });
    return { success: true, daysCount: days.length, syncedAt: new Date() };
  } catch (error) {
    const message = error?.message || String(error);
    await Pm25DailySnapshot.findOneAndUpdate(
      { key: "default" },
      { lastError: message },
      { upsert: true }
    );
    await writeSyncLog("daily", false, message);
    return { success: false, message };
  }
}

export async function syncPm25Monthly() {
  await dbConnect();
  const monthKey = getBangkokMonthKey();

  try {
    const history = await fetchDustboy1Year();
    const months = aggregateHourlyToMonthly(history?.value || []);
    if (!months.length) throw new Error("No monthly data from data1year");

    // upsert ทุกเดือนในหน้าต่าง 1 ปี (self-healing: เติมเดือนที่ cron เคยพลาด)
    // กันเดือนขอบหน้าต่างที่ข้อมูลรอบนี้บางกว่าเดิม ไม่ให้ทับของเดิมที่สมบูรณ์กว่า
    const existingDocs = await Pm25Monthly.find(
      { monthKey: { $in: months.map((m) => m.key) } },
      { monthKey: 1, count: 1 }
    ).lean();
    const existingCountByKey = new Map(
      existingDocs.map((d) => [d.monthKey, d.count || 0])
    );

    // เดือนปัจจุบันอัปเดตทุกวัน (count โตขึ้นเรื่อย ๆ) ส่วนเดือนที่จบแล้ว
    // เขียนซ้ำเฉพาะเมื่อข้อมูลเพิ่มจริง — syncedAt จึงสื่อ "ข้อมูลเปลี่ยนล่าสุด"
    // ไม่ถูกเขียนทับทุกวันทั้งตาราง
    const toUpsert = months.filter((m) => {
      const existingCount = existingCountByKey.get(m.key);
      if (existingCount === undefined) return true;
      return m.key === monthKey ? m.count >= existingCount : m.count > existingCount;
    });

    if (toUpsert.length) {
      const now = new Date();
      await Pm25Monthly.bulkWrite(
        toUpsert.map((m) => ({
          updateOne: {
            filter: { monthKey: m.key },
            update: {
              $set: {
                monthKey: m.key,
                month: m.month,
                year: m.year,
                name: m.name,
                fullName: m.fullName,
                avg: m.avg,
                count: m.count,
                syncedAt: now,
              },
            },
            upsert: true,
          },
        }))
      );
    }

    const skippedOlder = months.length - toUpsert.length;
    await writeSyncLog("monthly", true, "OK", {
      monthKey,
      upserted: toUpsert.length,
      skippedOlder,
    });
    return { success: true, monthKey, upserted: toUpsert.length, skippedOlder };
  } catch (error) {
    const message = error?.message || String(error);
    await writeSyncLog("monthly", false, message, { monthKey });
    return { success: false, message };
  }
}
