// lib/flood-relief/loadSettings.ts (server-only)
// อ่านค่าตั้งศูนย์ฯ แล้ว normalize เสมอ — ไม่มีเอกสาร = ค่าเริ่มต้น (ศูนย์ฯ ปิด)

import dbConnect from "@/lib/dbConnect";
import FloodSettings from "@/models/flood-relief/FloodSettings";
import { normalizeSettings, type FloodSettingsValue } from "./settings";

export async function loadFloodSettings(): Promise<FloodSettingsValue & { updatedAt: Date | null; updatedBy: string }> {
  await dbConnect();
  const doc = (await FloodSettings.findOne({ key: "default" }).lean()) as
    | (Partial<Record<keyof FloodSettingsValue, unknown>> & { updatedAt?: Date; updatedBy?: string })
    | null;
  return { ...normalizeSettings(doc), updatedAt: doc?.updatedAt ?? null, updatedBy: doc?.updatedBy ?? "" };
}
