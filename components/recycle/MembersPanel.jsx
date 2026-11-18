// แท็บ "สมาชิก" — รายชื่อ ค้นหา กรองชุมชน
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { COMMUNITIES } from "@/lib/takhliCommunities";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";

export default function MembersPanel() {
  const [q, setQ] = useState("");
  const [community, setCommunity] = useState("");
  const [active, setActive] = useState("true");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ q, community, active, limit: "1000" });
      const json = await recycleFetch(`/members?${qs.toString()}`);
      setMembers(json.members);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, community, active]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-gray-900">สมาชิก ({members.length})</p>
          <Link
            href="/admin/recycle/members/new"
            className="h-12 px-5 rounded-2xl bg-emerald-700 text-white font-bold flex items-center hover:bg-emerald-800"
          >
            + เพิ่มสมาชิก
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="sr-only" htmlFor="m-q">
            ค้นหา
          </label>
          <input
            id="m-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา ชื่อ / เบอร์ / รหัส"
            className="h-12 rounded-2xl border border-gray-200/70 bg-white px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
          <label className="sr-only" htmlFor="m-community">
            ชุมชน
          </label>
          <select id="m-community" value={community} onChange={(e) => setCommunity(e.target.value)} className="h-12 rounded-2xl border border-gray-200/70 bg-white px-3">
            <option value="">ทุกชุมชน</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="m-active">
            สถานะ
          </label>
          <select id="m-active" value={active} onChange={(e) => setActive(e.target.value)} className="h-12 rounded-2xl border border-gray-200/70 bg-white px-3">
            <option value="true">ใช้งานอยู่</option>
            <option value="false">ปิดการใช้งาน</option>
            <option value="all">ทั้งหมด</option>
          </select>
        </div>
      </div>

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
                <th>รหัส</th>
                <th>ชื่อ-สกุล</th>
                <th className="hidden sm:table-cell">ชุมชน</th>
                <th className="text-right">สะสม (กก.)</th>
                <th className="text-right hidden sm:table-cell">ครั้ง</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id} className={m.isActive ? "" : "opacity-60"}>
                  <td className="font-mono whitespace-nowrap">{m.code}</td>
                  <td>
                    <Link href={`/admin/recycle/members/${m._id}`} className="font-semibold text-gray-900 hover:text-emerald-800">
                      {m.fullName}
                    </Link>
                    {m.phone && <div className="text-xs text-gray-500">{m.phone}</div>}
                  </td>
                  <td className="hidden sm:table-cell">{m.community || "-"}</td>
                  <td className="text-right font-semibold">{fmtKg(m.totalKg)}</td>
                  <td className="text-right hidden sm:table-cell">{m.depositCount}</td>
                  <td className="text-right">
                    {m.isActive && (
                      <Link
                        href={`/admin/recycle/deposit?code=${encodeURIComponent(m.code)}`}
                        className="inline-flex h-10 items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                      >
                        รับฝาก
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    ยังไม่มีสมาชิก — กด “เพิ่มสมาชิก”
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
