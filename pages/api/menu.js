import dbConnect from "@/lib/dbConnect";
import MenuMain from "@/models/MenuMain";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      const menus = await MenuMain.find({});
      res.status(200).json(menus);
    } catch (error) {
      console.error("❌ Mongo fetch error:", error);
      res.status(500).json({ error: "Failed to fetch menus" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}