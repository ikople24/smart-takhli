// /pages/api/register-object-health/[id].js

import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await dbConnect();
  const db = (await dbConnect()).connection.db;
  const collection = db.collection("register_object_health");

  if (req.method === "PATCH") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { ob_status, device_status } = body;
      
      // Build update object
      const updateFields = {};
      if (ob_status !== undefined) updateFields.ob_status = ob_status;
      if (device_status !== undefined) updateFields.device_status = device_status;
      updateFields.updatedAt = new Date();

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      res.status(200).json({ message: "Updated", updated: updateFields });
    } catch (err) {
      res.status(500).json({ error: "Update failed", detail: err.message });
    }
  }

  if (req.method === "DELETE") {
    await dbConnect();
    const db = (await dbConnect()).connection.db;
    const collection = db.collection("register_object_health");

    try {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      return res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
      return res.status(500).json({ error: "Delete failed", detail: err.message });
    }
  }
}