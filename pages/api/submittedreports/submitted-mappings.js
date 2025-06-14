// 📁 pages/api/submittedreports/submitted-mappings.js
import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("test"); // ฐานข้อมูล test
    const collection = db.collection("submitted_mapping_log");

    const docs = await collection
      .find({}, { projection: { mappingId: 1, _id: 0 } })
      .toArray();

    const mappingIds = docs.map((d) => d.mappingId);
    res.status(200).json(mappingIds); // ส่ง array กลับเลย
  } catch (err) {
    console.error("❌ Failed to fetch submitted mappings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}