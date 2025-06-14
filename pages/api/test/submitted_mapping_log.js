// /pages/api/test/submitted_mapping_log.js

import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("test");
    const collection = db.collection("submitted_mapping_log");

    const mappings = await collection.find().toArray();
    res.status(200).json(mappings);
  } catch (error) {
    console.error("❌ Failed to fetch mappings:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
}