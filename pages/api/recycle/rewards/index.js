// GET  /api/recycle/rewards?active=true|false|all
// POST /api/recycle/rewards  { name, kgCost, unit?, stock?, description?, sortOrder? }
import dbConnect from "@/lib/dbConnect";
import RecycleReward from "@/models/recycle/RecycleReward";
import { withRecycleAuth } from "../_auth";
import { normalizeRewardInput } from "@/lib/recycle/balance";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  if (req.method === "GET") {
    const { active = "true" } = req.query;
    const filter = {};
    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;
    const rewards = await RecycleReward.find(filter).sort({ sortOrder: 1, kgCost: 1, name: 1 }).lean();
    return res.json({ success: true, rewards });
  }

  if (req.method === "POST") {
    const { data, errors } = normalizeRewardInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });
    const reward = await RecycleReward.create(data);
    return res.status(201).json({ success: true, reward });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
