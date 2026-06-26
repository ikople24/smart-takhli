import mongoose from "mongoose";

// ค่าจากเครื่องวัดของเทศบาล (ESP8266: DHT11 + PMSx003) ส่งเข้ามาตรง
// แทนที่ flow เดิม ESP8266 -> Google Apps Script -> Google Sheet
// 1 reading = 1 document (time-series) เลียนแบบ 1 แถวใน sheet เดิม
const Pm25DeviceReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, default: "esp8266-takhli", index: true },
    temp: { type: Number, default: null }, // °C
    humidity: { type: Number, default: null }, // %
    pm1: { type: Number, default: null }, // µg/m³
    pm25: { type: Number, default: null }, // µg/m³
    pm10: { type: Number, default: null }, // µg/m³
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "pm25_device_readings" }
);

export default mongoose.models.Pm25DeviceReading ||
  mongoose.model("Pm25DeviceReading", Pm25DeviceReadingSchema);
