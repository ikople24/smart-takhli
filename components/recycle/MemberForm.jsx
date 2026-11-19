// ฟอร์มเพิ่ม/แก้ไขสมาชิกโครงการพระสังข์หอบทอง
import { useState } from "react";
import { COMMUNITIES } from "@/lib/takhliCommunities";

const inputClass =
  "h-12 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-4 text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none";

export default function MemberForm({ initial = {}, submitLabel = "บันทึก", onSubmit, saving = false, showActiveToggle = false }) {
  const [form, setForm] = useState({
    fullName: initial.fullName || "",
    phone: initial.phone || "",
    community: initial.community || "",
    groupName: initial.groupName || "",
    address: initial.address || "",
    note: initial.note || "",
    isActive: initial.isActive !== false,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อ-สกุล <span className="text-red-600">*</span>
        </label>
        <input id="fullName" value={form.fullName} onChange={set("fullName")} required maxLength={120} className={inputClass} />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          เบอร์โทร
        </label>
        <input
          id="phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d]/g, "").slice(0, 10) }))}
          inputMode="tel"
          placeholder="08xxxxxxxx"
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">ใช้ค้นหาสมาชิกตอนลืมบัตร</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="community" className="block text-sm font-medium text-gray-700 mb-1">
            ชุมชน
          </label>
          <select id="community" value={form.community} onChange={set("community")} className={inputClass}>
            <option value="">— ไม่ระบุ —</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
            กลุ่ม / จุดรับ
          </label>
          <input id="groupName" value={form.groupName} onChange={set("groupName")} placeholder="เช่น กลุ่ม 1" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          ที่อยู่
        </label>
        <input id="address" value={form.address} onChange={set("address")} className={inputClass} />
      </div>

      <div>
        <label htmlFor="memberNote" className="block text-sm font-medium text-gray-700 mb-1">
          หมายเหตุ
        </label>
        <textarea
          id="memberNote"
          value={form.note}
          onChange={set("note")}
          rows={2}
          className="w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
        />
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <input
            type="checkbox"
            className="checkbox checkbox-success"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span className="text-base text-gray-800">ยังเป็นสมาชิกอยู่ (ปิด = ไม่ให้บันทึกการฝาก)</span>
        </label>
      )}

      <button
        type="submit"
        disabled={saving || !form.fullName.trim()}
        className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
      >
        {saving ? "กำลังบันทึก..." : submitLabel}
      </button>
    </form>
  );
}
