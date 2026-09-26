import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import FloodTeam from "@/models/flood-relief/FloodTeam";
import { adminListItem } from "@/lib/flood-relief/adminView";
import { fromGeoPoint } from "@/lib/flood-relief/geo";
import { notifyReporterStatus, notifyTeamAssigned } from "@/lib/flood-relief/notify";
import { isClosedStatus, isRequestType, isUrgency } from "@/lib/flood-relief/status";
import { planStatusChange } from "@/lib/flood-relief/statusChange";
import { requireFloodAdmin } from "../_auth";

const NOTE_MAX = 1000;

/**
 * GET   /api/flood-relief/requests/[id] — รายละเอียดเต็ม (เบอร์ ชื่อ รายละเอียด รูป บันทึกภายใน ไทม์ไลน์)
 * PATCH /api/flood-relief/requests/[id] — **จุดเดียว**ที่เขียนสถานะ/มอบหมาย/โน้ต
 *   { action: "status", to, reason? }  เดินหน้าทีละขั้น · ย้อน/เปิดคำขอยกเลิก = หัวหน้ากอง/superadmin + เหตุผล
 *   { action: "assign", teamId }       มอบหมายทีม → สถานะเป็น "ทีมออกเดินทาง" + แจ้ง LINE ทีม
 *   { action: "note", text }           บันทึกภายใน (ผู้แจ้งไม่เห็น)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "รองรับเฉพาะ GET/PATCH" });
  }
  const auth = await requireFloodAdmin(req).catch((err) => {
    console.error("[flood-relief/requests/[id]] auth", err);
    return null;
  });
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const id = String(req.query.id ?? "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "รหัสคำขอไม่ถูกต้อง" });

  try {
    await dbConnect();
    const doc = (await FloodRequest.findById(id).select("+lineUserId").lean()) as Record<string, unknown> | null;
    if (!doc) return res.status(404).json({ error: "ไม่พบคำขอ" });

    if (req.method === "GET") return res.status(200).json({ request: detail(doc) });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const now = new Date();
    const status = String(doc.status ?? "received");
    const ticket = String(doc.ticket);

    if (body.action === "note") {
      const text = String(body.text ?? "").trim().slice(0, NOTE_MAX);
      if (!text) return res.status(400).json({ error: "กรุณาพิมพ์บันทึก" });
      await FloodRequest.updateOne(
        { _id: id },
        { $push: { notes: { by: auth.name, byClerkId: auth.userId, at: now, text } } }
      );
    } else if (body.action === "status") {
      const plan = planStatusChange(status, String(body.to ?? ""), {
        canRewind: auth.canRewind,
        now,
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
      if (!plan.ok) return res.status(400).json({ error: plan.reason });
      // เงื่อนไข status เดิมกันสองคนกดพร้อมกันแล้วข้ามขั้น
      const r = await FloodRequest.updateOne(
        { _id: id, status },
        {
          $set: plan.set,
          ...(plan.unset.length ? { $unset: Object.fromEntries(plan.unset.map((f) => [f, ""])) } : {}),
          $push: { timeline: { at: now, event: plan.event, by: auth.name } },
        }
      );
      if (r.matchedCount === 0) return res.status(409).json({ error: "มีคนอัปเดตคำขอนี้ไปแล้ว กรุณาโหลดใหม่" });
      if (doc.assignedTeamId && isClosedStatus(String(body.to))) await releaseTeam(doc.assignedTeamId);
      notifyReporterStatus(doc.lineUserId as string | undefined, ticket, String(body.to));
    } else if (body.action === "assign") {
      if (isClosedStatus(status)) return res.status(400).json({ error: "คำขอนี้ปิดแล้ว" });
      const teamId = String(body.teamId ?? "");
      if (!mongoose.isValidObjectId(teamId)) return res.status(400).json({ error: "กรุณาเลือกทีม" });
      const team = (await FloodTeam.findOne({ _id: teamId, active: true }).lean()) as Record<string, unknown> | null;
      if (!team) return res.status(404).json({ error: "ไม่พบทีม" });

      const set: Record<string, unknown> = { assignedTeamId: team._id, assignedAt: now };
      // มอบหมายก่อนทีมออกเดินทาง = ถือว่าส่งทีมออกไปแล้ว · มอบหมายใหม่ตอนทีมอยู่หน้างาน = เปลี่ยนทีมอย่างเดียว
      const dispatchNow = status === "received" || status === "assigning";
      if (dispatchNow) {
        set.status = "dispatched";
        set.dispatchedAt = now;
      }
      const r = await FloodRequest.updateOne(
        { _id: id, status },
        { $set: set, $push: { timeline: { at: now, event: `มอบหมาย${String(team.name)}`, by: auth.name } } }
      );
      if (r.matchedCount === 0) return res.status(409).json({ error: "มีคนอัปเดตคำขอนี้ไปแล้ว กรุณาโหลดใหม่" });
      if (doc.assignedTeamId && String(doc.assignedTeamId) !== teamId) await releaseTeam(doc.assignedTeamId);
      await FloodTeam.updateOne({ _id: team._id }, { $set: { status: "busy" } });

      const point = fromGeoPoint(doc.location as { coordinates?: unknown });
      if (point && isRequestType(doc.type) && isUrgency(doc.urgency)) {
        notifyTeamAssigned(team.lineGroupId as string | undefined, {
          ticket,
          type: doc.type,
          urgency: doc.urgency,
          point,
          communityName: (doc.communityName as string) ?? null,
          zoneName: (doc.zoneName as string) ?? null,
          zoneLevel: (doc.zoneLevel as string) ?? null,
          landmark: doc.landmark as string,
          peopleCount: (doc.peopleCount as number) ?? null,
          phone: String(doc.phone ?? ""),
          createdAt: new Date(doc.createdAt as Date),
          teamName: String(team.name),
          assignedBy: auth.name,
        });
      }
      if (dispatchNow) notifyReporterStatus(doc.lineUserId as string | undefined, ticket, "dispatched");
    } else {
      return res.status(400).json({ error: "action ไม่ถูกต้อง" });
    }

    const fresh = (await FloodRequest.findById(id).select("+lineUserId").lean()) as Record<string, unknown>;
    return res.status(200).json({ request: detail(fresh) });
  } catch (err) {
    console.error("[flood-relief/requests/[id]]", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}

/** ทีมว่างเมื่อไม่มีคำขอที่ยังเปิดค้างอยู่กับทีมนั้นแล้ว */
async function releaseTeam(teamId: unknown) {
  const open = await FloodRequest.countDocuments({
    assignedTeamId: teamId,
    status: { $in: ["assigning", "dispatched", "on_site"] },
  });
  if (open === 0) await FloodTeam.updateOne({ _id: teamId }, { $set: { status: "idle" } });
}

function detail(doc: Record<string, unknown>) {
  return {
    ...adminListItem(doc),
    detail: (doc.detail as string) ?? "",
    images: (doc.images as string[]) ?? [],
    notes: (doc.notes as unknown[]) ?? [],
    timeline: (doc.timeline as unknown[]) ?? [],
  };
}
