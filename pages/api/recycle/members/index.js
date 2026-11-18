// GET  /api/recycle/members?q=&community=&code=&token=&active=all|true|false&limit=
// POST /api/recycle/members  { fullName, phone, community, groupName, address, note }
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import { withRecycleAuth } from "../_auth";
import { normalizeMemberInput } from "@/lib/recycle/validate";
import { nextMemberCode, normalizeMemberCode } from "@/lib/recycle/memberCode";
import { ensurePublicTokens, generatePublicToken, isPublicToken } from "@/lib/recycle/publicToken";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  if (req.method === "GET") {
    const { q = "", community = "", code = "", token = "", active = "true" } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);

    // ค้นด้วย token ใน QR (หน้า /recycle/m ใช้เช็คว่าเป็นเจ้าหน้าที่แล้วพาไปหน้ากรอกน้ำหนัก)
    if (token) {
      if (!isPublicToken(token)) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
      const member = await RecycleMember.findOne({ publicToken: token }).lean();
      if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
      return res.json({ success: true, member });
    }

    // ค้นด้วยรหัสตรง ๆ
    if (code) {
      const member = await RecycleMember.findOne({ code: normalizeMemberCode(code) }).lean();
      if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิกรหัสนี้" });
      return res.json({ success: true, member });
    }

    const filter = {};
    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;
    if (community) filter.community = String(community);
    const term = String(q).trim();
    if (term) {
      const re = new RegExp(escapeRegex(term), "i");
      const codeGuess = normalizeMemberCode(term);
      filter.$or = [{ fullName: re }, { phone: re }, { code: re }, { code: codeGuess }];
    }

    const members = await RecycleMember.find(filter).sort({ code: 1 }).limit(limit).lean();
    await ensurePublicTokens(RecycleMember, members); // สมาชิกเก่าที่ยังไม่มี token (ใช้พิมพ์บัตร)
    return res.json({ success: true, members });
  }

  if (req.method === "POST") {
    const { data, errors } = normalizeMemberInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });

    if (data.phone) {
      const dup = await RecycleMember.findOne({ phone: data.phone, isActive: true }).lean();
      if (dup) {
        return res
          .status(409)
          .json({ success: false, message: `เบอร์นี้เป็นสมาชิกอยู่แล้ว: ${dup.fullName} (${dup.code})`, member: dup });
      }
    }

    const code = await nextMemberCode();
    const member = await RecycleMember.create({
      ...data,
      code,
      publicToken: generatePublicToken(),
      createdBy: { clerkId: auth.userId, name: auth.name },
    });
    return res.status(201).json({ success: true, member });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
