import dbConnect from "@/lib/dbConnect";
import AdminOption from "@/models/AdminOption";

export default async function handler(req, res) {
  await dbConnect();

  const { method } = req;

  try {
    switch (method) {
      case "GET":
        const options = await AdminOption.find({});
        return res.status(200).json(options);

      case "POST":
        const created = await AdminOption.create(req.body);
        return res.status(201).json(created);

      case "PUT":
        const updated = await AdminOption.findByIdAndUpdate(req.body._id, req.body, { new: true });
        return res.status(200).json(updated);

      case "DELETE":
        await AdminOption.findByIdAndDelete(req.body._id);
        return res.status(204).end();

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}