import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  const db = (await dbConnect()).connection.db;
  try {
    const menu = await db.collection("menu_ob_health").find({}).toArray();
    res.status(200).json(menu);
  } catch (e) {
    console.error("Fetch menu_ob_health failed:", e);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}