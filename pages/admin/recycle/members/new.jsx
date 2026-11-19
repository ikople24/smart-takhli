// เพิ่มสมาชิกใหม่ — โครงการพระสังข์หอบทอง
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import MemberForm from "@/components/recycle/MemberForm";
import { recycleFetch } from "@/lib/recycle/client";

function NewMemberInner() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dupMember, setDupMember] = useState(null);
  const [created, setCreated] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const submit = async (form) => {
    setSaving(true);
    setError("");
    setDupMember(null);
    try {
      const json = await recycleFetch("/members", { method: "POST", body: form });
      setCreated(json.member);
    } catch (e) {
      setError(e.message);
      if (e.status === 409 && e.data?.member) setDupMember(e.data.member);
    } finally {
      setSaving(false);
    }
  };

  const addAnother = () => {
    setCreated(null);
    setFormKey((k) => k + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white px-4 py-5 pb-10">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
          <h1 className="text-lg font-bold text-gray-900">เพิ่มสมาชิกใหม่</h1>
          <p className="text-sm text-gray-500 mt-1">โครงการพระสังข์หอบทอง • ระบบออกรหัสสมาชิก (PS-xxxx) ให้อัตโนมัติ</p>
        </div>

        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5" role="alert">
            <p className="font-semibold text-amber-900">บันทึกไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
            {dupMember && (
              <Link
                href={`/admin/recycle/deposit?code=${encodeURIComponent(dupMember.code)}`}
                className="mt-3 inline-flex h-11 items-center rounded-2xl bg-white px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200"
              >
                ไปบันทึกการฝากของ {dupMember.code}
              </Link>
            )}
          </div>
        )}

        {created ? (
          <div className="space-y-3">
            <div className="rounded-3xl bg-emerald-50/90 ring-1 ring-emerald-200/80 p-6 text-center">
              <p className="text-sm text-emerald-800">เพิ่มสมาชิกแล้ว</p>
              <p className="text-xl font-bold text-emerald-900 mt-1">{created.fullName}</p>
              <p className="text-3xl font-bold tracking-wider text-emerald-700 mt-2 font-mono">{created.code}</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/admin/recycle/deposit?code=${encodeURIComponent(created.code)}`)}
              className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 shadow-sm"
            >
              บันทึกการฝากให้สมาชิกคนนี้เลย
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={addAnother}
                className="h-12 rounded-2xl border border-gray-200 bg-white font-semibold text-gray-800 hover:bg-gray-50"
              >
                เพิ่มคนถัดไป
              </button>
              <Link
                href="/admin/recycle?tab=cards"
                className="h-12 rounded-2xl border border-gray-200 bg-white font-semibold text-gray-800 hover:bg-gray-50 flex items-center justify-center"
              >
                พิมพ์บัตร QR
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
            <MemberForm key={formKey} submitLabel="เพิ่มสมาชิก" onSubmit={submit} saving={saving} />
          </div>
        )}

        <Link href="/admin/recycle?tab=members" className="block text-center text-sm font-semibold text-emerald-800 py-2">
          ← กลับไปรายชื่อสมาชิก
        </Link>
      </div>
    </main>
  );
}

export default function NewRecycleMemberPage() {
  return (
    <PermissionGuard requiredPath="/admin/recycle">
      <NewMemberInner />
    </PermissionGuard>
  );
}
