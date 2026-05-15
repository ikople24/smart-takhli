import dbConnect from "@/lib/dbConnect";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  const db = (await dbConnect()).connection.db;
  const collection = db.collection("register_object_health");
  try {
    const devices = await collection.find({}).toArray();
    res.status(200).json(devices);
  } catch {
    res.status(500).json({ error: "Database not connect" });
  }
}