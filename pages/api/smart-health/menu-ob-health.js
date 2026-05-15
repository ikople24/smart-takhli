import dbConnect from "@/lib/dbConnect";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  const db = (await dbConnect()).connection.db;
  try {
    const menu = await db.collection("menu_ob_health").find({}).toArray();
    res.status(200).json(menu);
  } catch (e) {
    console.error("Fetch menu_ob_health failed:", e);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}