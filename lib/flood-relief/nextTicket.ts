// lib/flood-relief/nextTicket.ts (server-only)
// ออกเลขที่คำขอถัดไปแบบ atomic จาก flood_counters — รูปแบบอยู่ที่ ticket.ts

import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { formatTicket, TICKET_COUNTER_ID } from "./ticket";

export async function nextTicket(): Promise<string> {
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const result = await db
    .collection<{ _id: string; seq: number }>("flood_counters")
    .findOneAndUpdate({ _id: TICKET_COUNTER_ID }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  // mongodb driver v6 คืน doc ตรง ๆ / v4-v5 คืน { value: doc } — รองรับทั้งคู่ (เหมือน lib/getNextSequence.js)
  const doc = (result && "seq" in result ? result : (result as unknown as { value?: { seq: number } })?.value) as
    | { seq: number }
    | undefined;
  if (typeof doc?.seq !== "number") throw new Error("ไม่สามารถออกเลขที่คำขอได้");
  return formatTicket(doc.seq);
}
