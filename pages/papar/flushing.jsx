// หน้าบันทึกโบตะกอนสำหรับเจ้าหน้าที่ภาคสนาม — ไม่ต้องล็อกอิน ใส่รหัสครั้งเดียวแล้วเครื่องจำไว้ (cookie 180 วัน)
// อยู่นอก /admin โดยตั้งใจ (_app ไม่บังคับ Clerk) · สิทธิ์จริงตรวจที่ /api/smart-papar/field/*
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import FlushingForm from "@/components/smart-papar/FlushingForm";

function UnlockForm({ onUnlocked }) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/smart-papar/field/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.message || "ยืนยันไม่สำเร็จ");
        return;
      }
      onUnlocked(data.name);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base focus:border-sky-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">สำหรับเจ้าหน้าที่กองการประปา</h2>
      <p className="text-sm text-slate-600">ใส่รหัสเจ้าหน้าที่ครั้งเดียว เครื่องนี้จะจำไว้ ครั้งต่อไปกดบันทึกได้เลย</p>
      <div>
        <label className="text-sm text-slate-600">ชื่อเจ้าหน้าที่</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
      </div>
      <div>
        <label className="text-sm text-slate-600">รหัสเจ้าหน้าที่</label>
        <input
          className={inputCls}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-sky-600 py-3 text-base font-semibold text-white disabled:opacity-60">
        {busy ? "กำลังตรวจสอบ…" : "ยืนยัน"}
      </button>
      {/* การ์ดน้ำประปาบนหน้าแรกพาทุกคนมาที่นี่ — ประชาชนที่เจอน้ำขุ่นต้องมีทางไปแจ้งเรื่อง */}
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        ประชาชนที่พบน้ำขุ่นหรือน้ำไม่ไหล{" "}
        <Link href="/report" className="font-semibold underline">
          แจ้งเรื่องที่นี่
        </Link>
      </div>
    </form>
  );
}

export default function FieldFlushingPage() {
  const [state, setState] = useState({ loading: true, unlocked: false, name: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/smart-papar/field/me");
      const data = await res.json();
      setState({ loading: false, unlocked: Boolean(data?.unlocked), name: data?.name || "" });
    } catch {
      setState({ loading: false, unlocked: false, name: "" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = async () => {
    await fetch("/api/smart-papar/field/me", { method: "DELETE" }).catch(() => {});
    setSavedCount(0);
    refresh();
  };

  return (
    <>
      <Head>
        <title>บันทึกโบตะกอน | เทศบาลเมืองตาคลี</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm text-sky-700">
              ← หน้าแรก
            </Link>
            {state.unlocked && (
              <button type="button" onClick={logout} className="text-sm text-slate-500 underline">
                ออกจากโหมดเจ้าหน้าที่
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 p-5 text-white">
            <div className="text-sm text-sky-100">กองการประปา · เทศบาลเมืองตาคลี</div>
            <h1 className="text-2xl font-bold">🚿 บันทึกโบตะกอน</h1>
            {state.unlocked && <p className="mt-1 text-sm text-sky-100">เจ้าหน้าที่: {state.name}</p>}
          </div>

          {state.loading ? (
            <div className="py-10 text-center text-slate-500">กำลังโหลด…</div>
          ) : !state.unlocked ? (
            <UnlockForm onUnlocked={() => refresh()} />
          ) : (
            <div className="space-y-3">
              {savedCount > 0 && (
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  ✅ บันทึกแล้ว {savedCount} รายการในรอบนี้
                </div>
              )}
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="w-full rounded-2xl bg-emerald-600 py-5 text-xl font-bold text-white shadow-sm"
              >
                + บันทึกโบตะกอน
              </button>
              <p className="text-center text-sm text-slate-500">
                กรอกผิดแจ้งหัวหน้าให้แก้ไขในระบบ (เจ้าหน้าที่ภาคสนามแก้/ลบเองไม่ได้)
              </p>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <FlushingForm
          log={null}
          createEndpoint="/api/smart-papar/field/flushing"
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            setSavedCount((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
