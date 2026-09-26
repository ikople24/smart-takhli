// models/flood-relief/FloodRequest.js
// คำขอความช่วยเหลือน้ำท่วม — 1 เอกสาร = 1 คำขอ (collection flood_requests)
// type / urgency / status ไม่ใส่ Mongoose enum: คุมค่าที่ชั้น API ด้วย lib/flood-relief/status.ts ที่เดียว
// เขียนสถานะผ่าน PATCH /api/flood-relief/requests/[id] เท่านั้น
// ⚠️ phone / lineUserId / notes / reporterName ห้ามส่งออก endpoint สาธารณะ — ใช้ PUBLIC_REQUEST_SELECT + publicRequest()
import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat] — สร้างผ่าน toGeoPoint() เท่านั้น
  },
  { _id: false }
);

const NoteSchema = new mongoose.Schema(
  {
    by: { type: String, default: "" }, // ชื่อเจ้าหน้าที่
    byClerkId: { type: String, default: "" },
    at: { type: Date, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const TimelineSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    event: { type: String, required: true }, // ข้อความที่แสดง เช่น "มอบหมายทีม ปภ. 1"
    by: { type: String, default: "" },
  },
  { _id: false }
);

const FloodRequestSchema = new mongoose.Schema(
  {
    // FL-0142 — เลขวิ่งต่อเนื่องจาก counter ใน flood_counters (lib/flood-relief/ticket.ts)
    ticket: { type: String, required: true },
    type: { type: String, required: true }, // evac | drain | sand | other
    urgency: { type: String, required: true }, // critical | urgent | normal
    status: { type: String, default: "received" },

    location: { type: PointSchema, required: true },
    accuracyM: { type: Number, default: null },
    landmark: { type: String, default: "" },
    peopleCount: { type: Number, default: null },
    reporterName: { type: String, default: "" },
    phone: { type: String, required: true },
    detail: { type: String, default: "" },
    images: { type: [String], default: [] },

    // ชุมชนจาก basemap geojsonfeatures ($geoIntersects) — ห้ามเดาจากชื่อซอย
    communityName: { type: String, default: null },
    communitySource: { type: String, enum: ["auto", "manual"], default: "auto" },
    // snapshot ตอนจัดโซน — re-assign ใหม่ทุกครั้งที่โซนเปลี่ยน (เฉพาะคำขอที่ยังไม่ปิด)
    zoneId: { type: mongoose.Schema.Types.ObjectId, default: null },
    zoneName: { type: String, default: null },
    zoneLevel: { type: String, default: null },

    assignedTeamId: { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedAt: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    onSiteAt: { type: Date, default: null },
    doneAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    notes: { type: [NoteSchema], default: [] }, // บันทึกภายใน ผู้แจ้งไม่เห็น
    timeline: { type: [TimelineSchema], default: [] },

    source: { type: String, enum: ["web", "line", "phone"], default: "web" },
    lineUserId: { type: String, default: null },
    // เก็บเพื่อ rate-limit ต่อ IP เท่านั้น
    clientIp: { type: String, default: "" },
  },
  { timestamps: true, collection: "flood_requests" }
);

FloodRequestSchema.index({ ticket: 1 }, { unique: true });
FloodRequestSchema.index({ location: "2dsphere" });
FloodRequestSchema.index({ status: 1, createdAt: -1 });
FloodRequestSchema.index({ updatedAt: -1 }); // polling ?since=
FloodRequestSchema.index({ phone: 1, createdAt: -1 }); // rate-limit ต่อเบอร์
FloodRequestSchema.index({ clientIp: 1, createdAt: -1 }); // rate-limit ต่อ IP
FloodRequestSchema.index({ zoneId: 1 });

export default mongoose.models.FloodRequest || mongoose.model("FloodRequest", FloodRequestSchema, "flood_requests");
