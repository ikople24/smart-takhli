// ตั้งค่าทีมงานโบตะกอน — จับคู่ "ชื่อคนบันทึก" ที่พบในระบบกับทีม (กองการประปา / ทีมงานป้องกัน)
// ทีมของบันทึกหาตอนอ่าน แก้แล้วรายงาน/คิวย้อนหลังเปลี่ยนตามทันที · ชื่อหนึ่งอยู่ได้ทีมเดียว
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function FlushingTeamsModal({ onClose, onSaved }) {
  const [teams, setTeams] = useState([]);
  const [names, setNames] = useState([]);
  const [assign, setAssign] = useState({}); // ชื่อ → teamKey ("" = ยังไม่จัดทีม)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const apply = (data) => {
    setTeams(data.teams);
    // ชื่อที่ตั้งไว้ในทีมแต่ยังไม่มีบันทึก (เช่น พิมพ์ชื่อไม่ตรง) ก็ต้องเห็นเพื่อถอดออกได้
    const known = new Set(data.names.map((n) => n.name));
    const extra = data.teams.flatMap((t) => t.members.filter((m) => !known.has(m)).map((m) => ({ name: m, count: 0 })));
    setNames([...data.names, ...extra]);
    const a = {};
    for (const t of data.teams) for (const m of t.members) a[m] = t.key;
    setAssign(a);
  };

  useEffect(() => {
    fetch("/api/smart-papar/flushing/teams")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) throw new Error(d?.message || "โหลดข้อมูลทีมไม่สำเร็จ");
        apply(d);
      })
      .catch((e) => setError(e.message || "โหลดข้อมูลทีมไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        teams: teams.map((t) => ({ key: t.key, members: names.map((n) => n.name).filter((n) => assign[n] === t.key) })),
      };
      const res = await fetch("/api/smart-papar/flushing/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "บันทึกไม่สำเร็จ");
      onSaved?.();
    } catch (e) {
      setError(e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-pp-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="teams-title">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2 border-b border-pp-line px-5 py-4">
          <div>
            <h2 id="teams-title" className="font-tk-sans text-xl font-bold">ตั้งค่าทีมงาน</h2>
            <p className="text-sm text-pp-muted">เลือกทีมให้ชื่อคนบันทึกแต่ละคน — รายงานและคิวงานจะแยกตามนี้</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 flex-none place-items-center rounded-full hover:bg-pp-ground">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-8 text-center text-pp-muted">กำลังโหลด…</p>
          ) : names.length === 0 ? (
            <p className="py-8 text-center text-pp-muted">ยังไม่มีบันทึกโบตะกอน</p>
          ) : (
            <ul className="divide-y divide-pp-line">
              {names.map((n) => (
                <li key={n.name} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{n.name}</span>
                    <span className="block text-[13px] text-pp-muted">
                      {n.count > 0 ? `บันทึก ${n.count} ครั้ง` : "ยังไม่มีบันทึกในชื่อนี้"}
                    </span>
                  </span>
                  <select
                    aria-label={`ทีมของ ${n.name}`}
                    value={assign[n.name] || ""}
                    onChange={(e) => setAssign((a) => ({ ...a, [n.name]: e.target.value }))}
                    className="h-10 rounded-xl border-[1.5px] border-pp-line-2 bg-white px-2.5 text-[15px] focus:border-pp-water focus:outline-none"
                  >
                    <option value="">ยังไม่จัดทีม</option>
                    {teams.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-pp-muted">
            ระบบจับคู่จากชื่อที่พิมพ์ตอนบันทึก ถ้าคนเดียวกันพิมพ์ชื่อไม่เหมือนกัน จะขึ้นเป็นคนละรายการ ให้เลือกทีมให้ทุกชื่อ
          </p>
        </div>

        <div className="space-y-2 border-t border-pp-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {error && <p className="text-sm text-pp-danger">{error}</p>}
          <button
            type="button"
            disabled={loading || saving}
            onClick={save}
            className="h-12 w-full rounded-xl bg-pp-water font-semibold text-white disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกทีม"}
          </button>
        </div>
      </div>
    </div>
  );
}
