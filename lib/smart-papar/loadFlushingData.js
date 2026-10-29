// ฝั่งเซิร์ฟเวอร์: โหลดทีม + คิวงานโบตะกอน — ใช้ร่วมกันระหว่าง API แอดมินและ API ภาคสนาม
import FlushingTeam from "@/models/smart-papar/FlushingTeam";
import FlushPoint from "@/models/smart-papar/FlushPoint";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { bangkokYmd } from "./flushing";
import { DEFAULT_TEAMS, buildQueue } from "./flushingSchedule";

// สร้างทีมตั้งต้นถ้ายังไม่มี ($setOnInsert — ไม่ทับสมาชิกที่ตั้งไว้แล้ว)
export async function loadTeams() {
  let teams = await FlushingTeam.find({}).sort({ order: 1 }).lean();
  if (teams.length < DEFAULT_TEAMS.length) {
    await FlushingTeam.bulkWrite(
      DEFAULT_TEAMS.map((t) => ({
        updateOne: { filter: { key: t.key }, update: { $setOnInsert: { ...t, members: [] } }, upsert: true },
      }))
    );
    teams = await FlushingTeam.find({}).sort({ order: 1 }).lean();
  }
  return teams.map((t) => ({ key: t.key, label: t.label, members: t.members || [] }));
}

// คิวของทุกหัวที่ใช้งาน — ดึงเฉพาะบันทึกล่าสุดต่อหัว (aggregate) ไม่โหลดทั้ง collection
export async function loadQueue(now = new Date()) {
  const [teams, points, latest] = await Promise.all([
    loadTeams(),
    FlushPoint.find({ active: true }).select({ code: 1, name: 1, roadName: 1, kind: 1, location: 1 }).lean(),
    FlushingLog.aggregate([
      { $match: { deletedAt: null, flushPointId: { $type: "objectId" } } },
      { $sort: { flushedAt: -1 } },
      {
        $group: {
          _id: "$flushPointId",
          flushPointId: { $first: "$flushPointId" },
          flushedAt: { $first: "$flushedAt" },
          result: { $first: "$result" },
          turbidCause: { $first: "$turbidCause" },
          createdByName: { $first: "$createdByName" },
          times: { $sum: 1 },
        },
      },
    ]),
  ]);
  const times = new Map(latest.map((l) => [String(l.flushPointId), l.times]));
  const items = buildQueue({ points, logs: latest, teams, today: bangkokYmd(now) }).map((i) => ({
    ...i,
    times: times.get(String(i.point._id)) || 0,
  }));
  return { teams, items };
}
