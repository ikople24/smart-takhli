import dbConnect from "@/lib/dbConnect";
import Pm25DeviceReading from "@/models/Pm25DeviceReading";

// รับค่าจากเครื่องวัด ESP8266 ส่งเข้ามาตรง (แทน Google Apps Script เดิม)
// ป้องกันด้วย shared secret ใน header `x-device-secret` (เทียบ requireCronSecret)
// ไม่ใช้ Clerk — เครื่องวัดเป็น machine client ไม่มี session

function toNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ state: "error", message: "Method not allowed" });
  }

  const expected = process.env.PM25_DEVICE_SECRET;
  if (!expected) {
    return res
      .status(500)
      .json({ state: "error", message: "Server misconfigured: PM25_DEVICE_SECRET is missing" });
  }
  const provided = req.headers["x-device-secret"] || req.query?.secret || "";
  if (String(provided) !== String(expected)) {
    return res.status(401).json({ state: "error", message: "Unauthorized" });
  }

  // รองรับทั้งชื่อ humidity และ humi (ตามของเดิม)
  const body = req.body || {};
  const reading = {
    deviceId: (body.deviceId && String(body.deviceId)) || undefined,
    temp: toNumber(body.temp),
    humidity: toNumber(body.humidity ?? body.humi),
    pm1: toNumber(body.pm1),
    pm25: toNumber(body.pm25),
    pm10: toNumber(body.pm10),
    recordedAt: new Date(),
  };

  // อย่าเก็บแถวว่างเปล่า — ต้องมีค่าวัดอย่างน้อยหนึ่งตัว
  const hasAnyValue = ["temp", "humidity", "pm1", "pm25", "pm10"].some(
    (k) => reading[k] !== null
  );
  if (!hasAnyValue) {
    return res
      .status(400)
      .json({ state: "error", message: "No sensor values provided" });
  }

  try {
    await dbConnect();
    const doc = await Pm25DeviceReading.create(reading);
    // คืน {"state":"success"} ให้ฝั่ง ESP เช็คง่ายเหมือนของเดิม
    return res.status(201).json({ state: "success", id: String(doc._id) });
  } catch (err) {
    console.error("[pm25/device-ingest] insert failed:", err);
    return res.status(500).json({ state: "error", message: "DB insert failed" });
  }
}
