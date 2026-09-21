// Seed ข้อมูลทดสอบทะเบียนท่อประปา + ติดตั้ง index
//   node --env-file=.env.local --import tsx scripts/seed-water.ts
//
// idempotent: ลบเฉพาะเอกสาร seed เดิม (SEED-DATA) แล้วเขียนใหม่ — ข้อมูลจริงไม่ถูกแตะ
// ⚠️ พิกัดสมมติรอบตาคลี ไม่ใช่แนวท่อจริง — ห้ามเอาตัวเลขไปใช้ในรายงานจริง
import { pipes, nodes, ensureWaterIndexes } from "../lib/smart-water/db";
import { savePipe, saveNode } from "../lib/smart-water/service";

const SEED_TAG = "SEED-DATA";

const PIPES_SEED = [
  { material: "PVC" as const, diameter: { value: 4, unit: "inch" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2558,
    geometry: { type: "LineString" as const, coordinates: [[100.3480, 15.2585], [100.3532, 15.2601], [100.3578, 15.2612]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 8, unit: "inch" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2552,
    geometry: { type: "LineString" as const, coordinates: [[100.3578, 15.2612], [100.3625, 15.2588], [100.3661, 15.2554]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 6, unit: "inch" as const },
    roadName: "ถ.หัสนัย", status: "existing" as const, installedYear: 2560,
    geometry: { type: "LineString" as const, coordinates: [[100.3512, 15.2548], [100.3570, 15.2542], [100.3618, 15.2536]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 4, unit: "inch" as const },
    roadName: "ถ.วิษณุธรรม", status: "existing" as const, installedYear: 2561,
    geometry: { type: "LineString" as const, coordinates: [[100.3455, 15.2632], [100.3508, 15.2628]] as [number, number][] } },
  { material: "AC" as const, diameter: { value: 12, unit: "inch" as const },
    roadName: "ถ.วิษณุธรรม", status: "existing" as const, installedYear: 2535,
    geometry: { type: "LineString" as const, coordinates: [[100.3440, 15.2640], [100.3512, 15.2630], [100.3560, 15.2625]] as [number, number][] } },
  { material: "AC" as const, diameter: { value: 6, unit: "inch" as const },
    roadName: "ถ.สนามคลี", status: "existing" as const, installedYear: 2538,
    geometry: { type: "LineString" as const, coordinates: [[100.3390, 15.2668], [100.3448, 15.2655]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 2, unit: "inch" as const },
    roadName: "ถ.ลูกคลี", status: "existing" as const, installedYear: 2563,
    geometry: { type: "LineString" as const, coordinates: [[100.3448, 15.2655], [100.3452, 15.2620]] as [number, number][] } },
  { material: "SP" as const, diameter: { value: 400, unit: "mm" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2548,
    geometry: { type: "LineString" as const, coordinates: [[100.3400, 15.2700], [100.3520, 15.2640], [100.3620, 15.2570]] as [number, number][] } },
  { material: "HDPE" as const, diameter: { value: 110, unit: "mm" as const },
    roadName: "หมู่บ้านอุดมสุข", status: "new" as const, installedYear: 2567,
    geometry: { type: "LineString" as const, coordinates: [[100.3690, 15.2600], [100.3712, 15.2598], [100.3714, 15.2570]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 16, unit: "inch" as const },
    roadName: "ถ.สนามคลี", status: "existing" as const, installedYear: 2555,
    geometry: { type: "LineString" as const, coordinates: [[100.3405, 15.2680], [100.3470, 15.2652], [100.3530, 15.2618]] as [number, number][] } },
  { material: "GS" as const, diameter: { value: 2, unit: "inch" as const },
    roadName: "ถ.รุ่งทา 1", status: "abandoned" as const, installedYear: 2530,
    geometry: { type: "LineString" as const, coordinates: [[100.3462, 15.2678], [100.3488, 15.2672]] as [number, number][] } },
  { material: "RCP" as const, diameter: { value: 30, unit: "cm" as const },
    roadName: "ถ.หัสนัย", status: "existing" as const, installedYear: 2559,
    geometry: { type: "LineString" as const, coordinates: [[100.3618, 15.2536], [100.3640, 15.2510]] as [number, number][] } },
];

const NODES_SEED = [
  { type: "hydrant" as const, hydrantNo: "HD-001", condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3532, 15.2601] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-002", condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3578, 15.2612] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-003", condition: "damaged" as const,
    accessNote: "มีรถจอดบังประจำ",
    geometry: { type: "Point" as const, coordinates: [100.3570, 15.2542] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-004", condition: "unknown" as const,
    geometry: { type: "Point" as const, coordinates: [100.3700, 15.2599] as [number, number] } },
  { type: "gate_valve" as const, size: '8"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3625, 15.2588] as [number, number] } },
  { type: "gate_valve" as const, size: '4"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3508, 15.2628] as [number, number] } },
  { type: "gate_valve" as const, size: '16"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3470, 15.2652] as [number, number] } },
  { type: "tap" as const,
    geometry: { type: "Point" as const, coordinates: [100.3448, 15.2655] as [number, number] } },
  { type: "end_cap" as const,
    geometry: { type: "Point" as const, coordinates: [100.3714, 15.2570] as [number, number] } },
  { type: "blow_off" as const, condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3640, 15.2510] as [number, number] } },
  { type: "water_meter" as const,
    geometry: { type: "Point" as const, coordinates: [100.3452, 15.2620] as [number, number] } },
];

async function main() {
  await ensureWaterIndexes();
  console.log("ติดตั้ง index เรียบร้อย");

  const pipeCol = await pipes();
  const nodeCol = await nodes();

  // ลบเฉพาะของ seed เดิม — ห้ามล้างทั้ง collection
  await pipeCol.deleteMany({ "sourceDoc.pdfName": SEED_TAG });
  await nodeCol.deleteMany({ note: SEED_TAG });

  for (const p of PIPES_SEED) {
    await savePipe({
      ...p,
      ownership: "municipality",
      lengthSource: "computed",
      sourceDoc: { pdfName: SEED_TAG, confidence: "low" },
    });
  }
  for (const n of NODES_SEED) {
    await saveNode({ ...n, note: SEED_TAG });
  }

  const rows = await pipeCol.find({ "sourceDoc.pdfName": SEED_TAG }).toArray();
  const total = rows.reduce((s, p) => s + (p.lengthM || 0), 0);
  console.log(`ใส่ท่อ ${rows.length} เส้น รวม ${total.toFixed(2)} ม.`);
  console.log(`ใส่ node ${NODES_SEED.length} จุด`);
  console.log("⚠️  ข้อมูลชุดนี้เป็นข้อมูลทดสอบ พิกัดสมมติ ไม่ใช่แนวท่อจริง");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
