// components/flood-relief/admin/ZoneManager.tsx — หน้าต่าง "จัดการโซนทั้งหมด" (superadmin)
// ชื่อ · ระดับ · เปิด/ปิด · จำนวนคำขอที่ยังเปิด · แก้ไขล่าสุดโดยใคร · ลบ
import { useState } from "react";
import Swal from "sweetalert2";
import { Trash2, X } from "lucide-react";
import { ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";
import { hhmm } from "./labels";
import type { AdminZone } from "./types";
import { zoneRequest } from "./zoneApi";

export default function ZoneManager({
  zones,
  onClose,
  onChanged,
  onFocus,
}: {
  zones: AdminZone[];
  onClose: () => void;
  onChanged: () => void;
  onFocus: (z: AdminZone) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (z: AdminZone, body: Record<string, unknown>) => {
    setBusy(z.id);
    if (await zoneRequest("PATCH", z.id, body)) onChanged();
    setBusy(null);
  };

  const remove = async (z: AdminZone) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: `ลบโซน ${z.name}?`,
      text: "ลบถาวร — ถ้าแค่ต้องการซ่อนชั่วคราว ให้ปิดใช้งานแทน",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#B92544",
    });
    if (!ok.isConfirmed) return;
    setBusy(z.id);
    if (await zoneRequest("DELETE", z.id)) onChanged();
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="จัดการโซนทั้งหมด">
      <div className="max-h-[85vh] w-full max-w-[720px] overflow-hidden rounded-2xl bg-white font-tk-sans text-tk-ink shadow-xl">
        <div className="flex items-center justify-between border-b border-tk-line px-5 py-3.5">
          <h2 className="text-[16px] font-bold">จัดการโซนทั้งหมด ({zones.length})</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-8 w-8 items-center justify-center rounded-full bg-tk-unclaimed-soft">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {zones.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-tk-ink-4">ยังไม่มีโซน — ปิดหน้าต่างนี้แล้วกดปุ่มวาดบนแผนที่</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="bg-tk-bg text-left text-[11px] text-tk-ink-4">
                <tr>
                  <th className="px-4 py-2 font-semibold">ชื่อ</th>
                  <th className="px-2 py-2 font-semibold">ระดับ</th>
                  <th className="px-2 py-2 text-center font-semibold">คำขอในโซน</th>
                  <th className="px-2 py-2 text-center font-semibold">ใช้งาน</th>
                  <th className="px-2 py-2 font-semibold">แก้ไขล่าสุด</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className={`border-t border-tk-line-light ${z.active ? "" : "opacity-55"}`}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: ZONE_META[z.level as ZoneLevel]?.fill ?? "#ccc" }} />
                        <input
                          defaultValue={z.name}
                          maxLength={20}
                          aria-label={`ชื่อโซน ${z.name}`}
                          disabled={busy === z.id}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== z.name) patch(z, { name: v });
                          }}
                          className="h-8 w-24 rounded-lg border border-tk-line px-2 font-bold focus:border-tk-flood focus:outline-none"
                        />
                        <button type="button" onClick={() => onFocus(z)} className="text-[11px] font-semibold text-tk-flood underline">
                          ดูบนแผนที่
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={z.level}
                        disabled={busy === z.id}
                        aria-label={`ระดับโซน ${z.name}`}
                        onChange={(e) => patch(z, { level: e.target.value })}
                        className="h-8 rounded-lg border border-tk-line px-1.5"
                      >
                        {ZONE_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {ZONE_META[l].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center font-bold tabular-nums">{z.openCount}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        checked={z.active}
                        disabled={busy === z.id}
                        aria-label={`เปิดใช้งานโซน ${z.name}`}
                        onChange={() => patch(z, { active: !z.active })}
                      />
                    </td>
                    <td className="px-2 py-2 text-[11px] text-tk-ink-4">
                      {z.updatedBy || "-"}
                      {z.updatedAt ? ` · ${hhmm(z.updatedAt)}` : ""}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(z)}
                        disabled={busy === z.id}
                        aria-label={`ลบโซน ${z.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-tk-overdue-ink hover:bg-tk-overdue-soft"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="border-t border-tk-line px-5 py-2.5 text-[11px] text-tk-ink-4">
          ปิดใช้งาน = ซ่อนจากแผนที่และไม่นับระดับสถานการณ์ แต่ยังเก็บไว้เปิดกลับได้ · ทุกการแก้ไขบันทึกใน audit log
        </p>
      </div>
    </div>
  );
}
