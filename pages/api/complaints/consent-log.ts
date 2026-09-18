import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import ReportConsentLog from "@/models/complaints/ReportConsentLog";
import { validateConsentLog } from "@/lib/citizen/report/consent";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

/**
 * บันทึกหลักฐานการกดยอมรับข้อตกลงก่อนแจ้งเรื่อง (จอ consent บน /report)
 *
 * ทางเขียนสาธารณะ ไม่ผ่าน Clerk เพราะผู้แจ้งไม่มีบัญชี — กันความเสียหายด้วยการ
 * เก็บน้อยที่สุด ตรวจ body เข้ม upsert ทับตัวเดิม และไม่มี GET ให้อ่านกลับ
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }

  // header เดียวกับที่ฟอร์มส่งเรื่องใช้ — กันคำขอที่ไม่ได้มาจากแอปนี้ระดับพื้นฐาน
  if (APP_ID && req.headers["x-app-id"] !== APP_ID) {
    return res.status(400).json({ error: "คำขอไม่ถูกต้อง" });
  }

  const parsed = validateConsentLog(req.body);
  if (!parsed.ok || !parsed.value) {
    return res.status(400).json({ error: parsed.error ?? "คำขอไม่ถูกต้อง" });
  }

  const { version, acceptedAt, deviceId } = parsed.value;

  try {
    await dbConnect();
    await ReportConsentLog.updateOne(
      { deviceId, version },
      { $set: { acceptedAt }, $setOnInsert: { deviceId, version, appId: APP_ID } },
      { upsert: true }
    );
    return res.status(204).end();
  } catch (err) {
    // คนละคำขอชนกันตอน upsert แถวเดียวกัน แถวที่ต้องการมีอยู่แล้ว
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 11000) {
      return res.status(204).end();
    }
    console.error("[complaints/consent-log]", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
