import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";
import { validateCoords } from "./index";
import { LAMP_TYPE_VALUES } from "@/lib/smart-light/constants";

export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  const { id } = req.query;
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, message: "รหัสอ้างอิงไม่ถูกต้อง" });
  }

  if (req.method === "GET") {
    try {
      const doc = await StreetLightPole.findById(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: doc });
    } catch (error) {
      console.error("smart-light pole GET error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { group, lampType, lat, lng, note, name } = req.body || {};
      const update = {};

      if (group !== undefined) {
        const groupName = String(group).trim();
        if (!groupName) {
          return res.status(400).json({ success: false, message: "ชุมชน/กลุ่มห้ามว่าง" });
        }
        update.group = groupName;
      }
      if (lampType !== undefined) {
        if (!LAMP_TYPE_VALUES.includes(String(lampType))) {
          return res.status(400).json({ success: false, message: "ชนิดโคมไม่ถูกต้อง" });
        }
        update.lampType = String(lampType);
      }
      if (lat !== undefined || lng !== undefined) {
        const coordError = validateCoords(lat, lng);
        if (coordError) {
          return res.status(400).json({ success: false, message: coordError });
        }
        update.lat = Number(lat);
        update.lng = Number(lng);
      }
      if (note !== undefined) update.note = String(note);
      if (name !== undefined) update.name = String(name).trim();

      const doc = await StreetLightPole.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true }
      ).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: doc });
    } catch (error) {
      console.error("smart-light pole PUT error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const doc = await StreetLightPole.findByIdAndDelete(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
      }
      return res.status(200).json({ success: true, data: { deletedCode: doc.code } });
    } catch (error) {
      console.error("smart-light pole DELETE error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
