// แก้ไขสมาชิก + ดูประวัติการฝาก — โครงการพระสังข์หอบทอง
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import MemberForm from "@/components/recycle/MemberForm";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { formatThaiDate } from "@/lib/recycle/dates";
import { getWasteTypeLabel } from "@/lib/recycle/wasteTypes";
import { getBalanceKg } from "@/lib/recycle/balance";

function EditMemberInner() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [member, setMember] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const json = await recycleFetch(`/members/${id}`);
      setMember(json.member);
      setDeposits(json.deposits || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (form) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const json = await recycleFetch(`/members/${id}`, { method: "PUT", body: form });
      setMember(json.member);
      setSuccess("บันทึกการแก้ไขแล้ว");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white px-4 py-5 pb-10">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">ข้อมูลสมาชิก</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">{member?.code || "..."}</p>
          </div>
          {member && (
            <Link
              href={`/admin/recycle/deposit?code=${encodeURIComponent(member.code)}`}
              className="h-11 shrink-0 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white flex items-center hover:bg-emerald-800"
            >
              บันทึกการฝาก
            </Link>
          )}
        </div>

        {loading && <div className="rounded-3xl bg-white/80 ring-1 ring-gray-200/60 p-6 text-center text-gray-500">กำลังโหลด...</div>}
        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5 text-sm text-amber-800" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-3xl bg-emerald-50/90 ring-1 ring-emerald-200/80 p-4 text-sm font-medium text-emerald-900">{success}</div>
        )}

        {member && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 p-4">
                <p className="text-xs text-gray-500">ฝากทั้งหมด</p>
                <p className="text-lg font-bold">{fmtKg(member.totalKg)} กก.</p>
                <p className="text-xs text-gray-500">{member.depositCount} ครั้ง</p>
              </div>
              <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 p-4">
                <p className="text-xs text-gray-500">แลกไปแล้ว</p>
                <p className="text-lg font-bold">{fmtKg(member.redeemedKg)} กก.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4">
                <p className="text-xs text-emerald-800">คงเหลือ</p>
                <p className="text-lg font-bold text-emerald-700">{fmtKg(getBalanceKg(member))} กก.</p>
              </div>
            </div>
            {member.isActive && (
              <Link
                href={`/admin/recycle/redeem?code=${encodeURIComponent(member.code)}`}
                className="h-12 w-full rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-semibold flex items-center justify-center hover:bg-amber-100"
              >
                แลกของ (ตัดยอด)
              </Link>
            )}

            <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
              <MemberForm key={member._id + member.updatedAt} initial={member} onSubmit={submit} saving={saving} showActiveToggle submitLabel="บันทึกการแก้ไข" />
            </div>

            <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
              <p className="text-base font-semibold text-gray-900">ประวัติการฝากล่าสุด</p>
              {deposits.length === 0 && <p className="text-sm text-gray-500 mt-2">ยังไม่มีการฝาก</p>}
              <ul className="mt-2 divide-y divide-gray-100">
                {deposits.map((d) => (
                  <li key={d._id} className="py-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{formatThaiDate(d.depositDate)}</span>
                      <span className="text-sm font-bold">{fmtKg(d.totalKg)} กก.</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {d.items.map((it) => `${getWasteTypeLabel(it.type)} ${fmtKg(it.kg)}`).join(" • ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Link href="/admin/recycle?tab=members" className="block text-center text-sm font-semibold text-emerald-800 py-2">
          ← กลับไปรายชื่อสมาชิก
        </Link>
      </div>
    </main>
  );
}

export default function EditRecycleMemberPage() {
  return (
    <PermissionGuard requiredPath="/admin/recycle">
      <EditMemberInner />
    </PermissionGuard>
  );
}
