// /admin/superadmin/flood-relief — เปิด/ปิดศูนย์ช่วยเหลือน้ำท่วม (superadmin เท่านั้น · โมดูล flood-relief)
// เปิดศูนย์ฯ = บล็อกหน้าแรกโผล่ + ฟอร์มรับคำขอ · ปิด = ซ่อนบล็อก และ API ปฏิเสธคำขอใหม่ (ให้โทรแทน)
// guard แบบเดียวกับ line-settings.jsx: ไม่ใช่ superadmin → redirect /admin
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@clerk/nextjs";
import Swal from "sweetalert2";

type Settings = {
  centerOpen: boolean;
  hotline: string;
  callbackSlaMin: number;
  announcement: string;
  updatedAt: string | null;
  updatedBy: string;
};

export default function FloodReliefSettingsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const isSuperAdmin = isLoaded && user?.publicMetadata?.role === "superadmin";
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.replace("/admin");
  }, [isLoaded, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/flood-relief/settings")
      .then((r) => r.json())
      .then((j) => j?.settings && setForm(j.settings))
      .catch(() => {});
  }, [isSuperAdmin]);

  const save = async (patch: Partial<Settings>, confirmText?: string) => {
    if (!form) return;
    if (confirmText) {
      const ok = await Swal.fire({
        icon: "question",
        title: confirmText,
        showCancelButton: true,
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ยกเลิก",
      });
      if (!ok.isConfirmed) return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/flood-relief/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "บันทึกไม่สำเร็จ");
      setForm(j.settings);
      Swal.fire({ icon: "success", title: "บันทึกแล้ว", timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin || !form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-tk-flood" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl font-tk-sans text-tk-ink">
      <div
        className={`rounded-[20px] p-5 text-white shadow-tk-flood-card ${form.centerOpen ? "bg-tk-flood" : "bg-tk-ink-3"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold text-white/80">สถานะศูนย์ฯ</div>
            <div className="text-[22px] font-bold">{form.centerOpen ? "เปิดรับคำขอ" : "ปิดอยู่"}</div>
            <p className="mt-1 text-[12.5px] leading-normal text-white/85">
              {form.centerOpen
                ? "บล็อกศูนย์ช่วยเหลือแสดงบนหน้าแรก และประชาชนส่งคำขอผ่านเว็บได้"
                : "บล็อกบนหน้าแรกถูกซ่อน · ฟอร์มจะแสดงเบอร์โทรแทน"}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              save(
                { centerOpen: !form.centerOpen },
                form.centerOpen ? "ปิดศูนย์ฯ และหยุดรับคำขอทางเว็บ?" : "เปิดศูนย์ฯ และแสดงบล็อกบนหน้าแรก?"
              )
            }
            className={`h-11 shrink-0 rounded-2xl px-5 text-[14px] font-bold ${
              form.centerOpen ? "bg-white text-tk-emergency" : "bg-white text-tk-flood"
            }`}
          >
            {form.centerOpen ? "ปิดศูนย์ฯ" : "เปิดศูนย์ฯ"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] bg-white p-5 shadow-tk-md">
        <label className="block text-[12.5px] font-semibold text-tk-ink-3" htmlFor="hotline">
          เบอร์ศูนย์ฯ (แสดงบนบล็อก ฟอร์ม และหน้าสถานะ)
        </label>
        <input
          id="hotline"
          value={form.hotline}
          onChange={(e) => setForm({ ...form, hotline: e.target.value })}
          className="input input-bordered mt-1.5 w-full font-tk-mono"
        />
        <label className="mt-4 block text-[12.5px] font-semibold text-tk-ink-3" htmlFor="sla">
          เจ้าหน้าที่โทรกลับภายใน (นาที)
        </label>
        <input
          id="sla"
          type="number"
          min={1}
          max={240}
          value={form.callbackSlaMin}
          onChange={(e) => setForm({ ...form, callbackSlaMin: Number(e.target.value) })}
          className="input input-bordered mt-1.5 w-32"
        />
        <label className="mt-4 block text-[12.5px] font-semibold text-tk-ink-3" htmlFor="announcement">
          ประกาศบนบล็อกหน้าแรก (ถ้ามี · สูงสุด 500 ตัวอักษร)
        </label>
        <textarea
          id="announcement"
          rows={2}
          maxLength={500}
          value={form.announcement}
          onChange={(e) => setForm({ ...form, announcement: e.target.value })}
          className="textarea textarea-bordered mt-1.5 w-full"
          placeholder="เช่น ศูนย์พักพิงเปิดที่โรงเรียนตาคลีประชาสรรค์"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-tk-ink-4">
            {form.updatedAt
              ? `แก้ไขล่าสุด ${new Date(form.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} โดย ${form.updatedBy || "-"}`
              : "ยังไม่เคยตั้งค่า (ใช้ค่าเริ่มต้น)"}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({})}
            className="h-10 rounded-xl bg-tk-flood px-5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
