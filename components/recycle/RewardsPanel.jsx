// แท็บ "ของรางวัล" — จัดการของที่ให้แลก (ใช้กี่ กก. / จำนวนคงเหลือ) + รายการแลกของวันนี้
import { useCallback, useEffect, useState } from "react";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";

const EMPTY = { name: "", kgCost: "", unit: "ชิ้น", stock: "", description: "", isActive: true };
const inputClass =
  "h-12 w-full rounded-2xl border border-gray-200/70 bg-white px-4 text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none";

export default function RewardsPanel() {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [today] = useState(getBangkokYMD());
  const [todayRedemptions, setTodayRedemptions] = useState([]);
  const [todayKg, setTodayKg] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const [r, t] = await Promise.all([recycleFetch("/rewards?active=all"), recycleFetch(`/redemptions?date=${today}`)]);
      setRewards(r.rewards);
      setTodayRedemptions(t.redemptions);
      setTodayKg(t.totalKg);
    } catch (e) {
      setError(e.message);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (r) => {
    setEditingId(r._id);
    setForm({
      name: r.name,
      kgCost: String(r.kgCost),
      unit: r.unit || "ชิ้น",
      stock: typeof r.stock === "number" ? String(r.stock) : "",
      description: r.description || "",
      isActive: r.isActive !== false,
    });
    document.getElementById("reward-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) await recycleFetch(`/rewards/${editingId}`, { method: "PUT", body: form });
      else await recycleFetch("/rewards", { method: "POST", body: form });
      cancelEdit();
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const voidRedemption = async (rd) => {
    const reason = window.prompt(`ยกเลิกการแลกของ ${rd.memberName} (${fmtKg(rd.totalKg)} กก.)\nกรุณาระบุเหตุผล:`);
    if (!reason || !reason.trim()) return;
    try {
      await recycleFetch(`/redemptions/${rd._id}`, { method: "DELETE", body: { reason } });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <form id="reward-form" onSubmit={submit} className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 space-y-3">
        <p className="text-base font-semibold text-gray-900">{editingId ? "แก้ไขของรางวัล" : "เพิ่มของรางวัล"}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="rw-name" className="block text-sm text-gray-700 mb-1">
              ชื่อของ <span className="text-red-600">*</span>
            </label>
            <input id="rw-name" value={form.name} onChange={set("name")} required placeholder="เช่น น้ำยาล้างจาน 500 มล." className={inputClass} />
          </div>
          <div>
            <label htmlFor="rw-kg" className="block text-sm text-gray-700 mb-1">
              ใช้น้ำหนักแลก (กก. ต่อ 1 หน่วย) <span className="text-red-600">*</span>
            </label>
            <input id="rw-kg" value={form.kgCost} onChange={set("kgCost")} inputMode="decimal" required placeholder="เช่น 5" className={inputClass} />
          </div>
          <div>
            <label htmlFor="rw-unit" className="block text-sm text-gray-700 mb-1">
              หน่วย
            </label>
            <input id="rw-unit" value={form.unit} onChange={set("unit")} placeholder="ชิ้น / ขวด / ถุง" className={inputClass} />
          </div>
          <div>
            <label htmlFor="rw-stock" className="block text-sm text-gray-700 mb-1">
              จำนวนคงเหลือ
            </label>
            <input id="rw-stock" value={form.stock} onChange={set("stock")} inputMode="numeric" placeholder="เว้นว่าง = ไม่จำกัด" className={inputClass} />
          </div>
          <div>
            <label htmlFor="rw-desc" className="block text-sm text-gray-700 mb-1">
              รายละเอียด
            </label>
            <input id="rw-desc" value={form.description} onChange={set("description")} className={inputClass} />
          </div>
        </div>
        {editingId && (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-success"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="text-sm text-gray-800">เปิดให้แลก</span>
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="h-12 px-6 rounded-2xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "+ เพิ่มของรางวัล"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="h-12 px-5 rounded-2xl border border-gray-200 bg-white font-semibold text-gray-800">
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-4 text-sm text-amber-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ของรางวัล</th>
                <th className="text-right">ใช้ (กก.)</th>
                <th className="text-right">คงเหลือ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => (
                <tr key={r._id} className={r.isActive ? "" : "opacity-60"}>
                  <td>
                    <span className="font-semibold text-gray-900">{r.name}</span>
                    {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                  </td>
                  <td className="text-right font-semibold whitespace-nowrap">
                    {fmtKg(r.kgCost)} / {r.unit}
                  </td>
                  <td className="text-right whitespace-nowrap">{typeof r.stock === "number" ? `${r.stock} ${r.unit}` : "ไม่จำกัด"}</td>
                  <td>{r.isActive ? <span className="text-emerald-700 text-sm">เปิดแลก</span> : <span className="text-gray-500 text-sm">ปิด</span>}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="h-10 px-3 rounded-xl bg-gray-50 text-sm font-semibold text-gray-800 hover:bg-gray-100"
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {rewards.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-8">
                    ยังไม่มีของรางวัล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-gray-900">แลกของวันนี้ ({formatThaiDate(today)})</p>
          <p className="text-sm text-gray-600">
            {todayRedemptions.length} ครั้ง • ตัดยอดรวม <strong className="text-gray-900">{fmtKg(todayKg)} กก.</strong>
          </p>
        </div>
        {todayRedemptions.length === 0 && <p className="text-sm text-gray-500 mt-3">ยังไม่มีการแลกวันนี้</p>}
        <ul className="mt-3 divide-y divide-gray-100">
          {todayRedemptions.map((rd) => (
            <li key={rd._id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">
                  {rd.memberName} <span className="text-sm font-normal text-gray-500">{rd.memberCode}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatThaiTime(rd.createdAt)} น. • {rd.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">บันทึกโดย {rd.recordedBy?.name || "-"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold">−{fmtKg(rd.totalKg)} กก.</p>
                <button type="button" onClick={() => voidRedemption(rd)} className="text-xs text-red-700 hover:underline mt-1">
                  ยกเลิก
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
