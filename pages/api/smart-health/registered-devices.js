import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  const db = (await dbConnect()).connection.db;
  const collection = db.collection("register_object_health");
  try {
    const devices = await collection.find({}).toArray();
    res.status(200).json(devices);
  } catch {
    res.status(500).json({ error: "Database not connect" });
  }
}