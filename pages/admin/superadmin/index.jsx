// pages/admin/superadmin/index.jsx
// หน้าจัดการ user + สิทธิ์ (superadmin เท่านั้น) — รีดีไซน์ 2026-08
// ลิสต์เดียว merge Clerk+Mongo (GET /api/permissions/users-overview) พร้อมสถานะต่อคน
// spec: docs/superpowers/specs/2026-08-27-superadmin-user-management-design.md
import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { Crown, Users, Search, RefreshCw, AlertTriangle, Building2, ListChecks } from "lucide-react";
import { STATUS } from "@/lib/superadmin/usersOverview";
import UserRow from "@/components/superadmin/UserRow";
import PermissionEditor from "@/components/superadmin/PermissionEditor";
import BulkGrantModal from "@/components/superadmin/BulkGrantModal";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const NEEDS_ACTION = [STATUS.BROKEN, STATUS.ORPHAN, STATUS.NO_DOC, STATUS.NO_APP];

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "needs_action", label: "ต้องดำเนินการ" },
  { key: "active", label: "ใช้งานได้" },
  { key: "other_app", label: "แอปอื่น" },
];

// key ประจำแถว: บางแถวไม่มี mongoId (no_doc) บางแถวอาจไม่มี clerkId (doc เก่า)
const rowKey = (u) => u.mongoId || u.clerkId;

export default function SuperAdminPage() {
  const { user } = useUser();
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [clerkUnavailable, setClerkUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState(null);
  const [editedPages, setEditedPages] = useState({}); // key = mongoId
  const [busy, setBusy] = useState({}); // key = rowKey
  const [bulkOpen, setBulkOpen] = useState(false);

  const isSuperAdmin = user?.publicMetadata?.role === "superadmin";

  useEffect(() => {
    if (user && !isSuperAdmin) {
      Swal.fire({
        icon: "error",
        title: "ไม่มีสิทธิ์เข้าถึง",
        text: "เฉพาะ Super Admin เท่านั้น",
        confirmButtonText: "กลับหน้าหลัก",
      }).then(() => router.replace("/"));
    }
  }, [user, isSuperAdmin, router]);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/permissions/users-overview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
      setRows(data.users || []);
      setClerkUnavailable(!!data.clerkUnavailable);
      const pagesMap = {};
      for (const u of data.users || []) {
        if (u.mongoId) pagesMap[u.mongoId] = u.allowedPages;
      }
      setEditedPages(pagesMap);
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "โหลดข้อมูลไม่สำเร็จ", text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchOverview();
  }, [isSuperAdmin, fetchOverview]);

  const withBusy = async (key, fn) => {
    try {
      setBusy((prev) => ({ ...prev, [key]: true }));
      await fn();
      await fetchOverview();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: e.message });
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const post = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");
    return data;
  };

  const onboard = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/create", {
        clerkId: u.clerkId,
        name: u.name || u.email,
        role: "admin",
        profileUrl: u.imageUrl,
      });
      Swal.fire({ icon: "success", title: "เพิ่มเข้าระบบแล้ว", text: `${u.name || u.email} ใช้งาน ${CURRENT_APP_ID} ได้แล้ว`, timer: 2000, showConfirmButton: false });
    });

  const assignApp = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/update-app-id", { userId: u.mongoId, appId: CURRENT_APP_ID });
      Swal.fire({ icon: "success", title: "กำหนด App แล้ว", timer: 1500, showConfirmButton: false });
    });

  const repair = async (u, action) => {
    if (action !== "fill_name") {
      const confirm = await Swal.fire({
        icon: "warning",
        title: action === "delete_stub" ? "ลบ stub doc?" : "ลบ doc ของบัญชีที่ถูกลบ?",
        text: "ข้อมูลเดิมจะถูกเก็บสำเนาไว้ใน Audit Log",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#dc2626",
      });
      if (!confirm.isConfirmed) return;
    }
    await withBusy(rowKey(u), async () => {
      // contract ใช้ mongoId — เจาะจง doc เดียวเสมอ (ดู spec/repair-user)
      await post("/api/permissions/repair-user", { mongoId: u.mongoId, action });
    });
  };

  const savePages = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/update-allowed-pages", {
        userId: u.mongoId,
        allowedPages: editedPages[u.mongoId] || [],
      });
      Swal.fire({ icon: "success", title: "บันทึกสิทธิ์แล้ว", timer: 1500, showConfirmButton: false });
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      const matchSearch =
        q === "" ||
        [u.name, u.email, u.department, u.position, u.clerkId]
          .some((f) => (f || "").toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (filter === "needs_action") return NEEDS_ACTION.includes(u.status);
      if (filter === "active") return u.status === STATUS.ACTIVE;
      if (filter === "other_app") return u.status === STATUS.OTHER_APP;
      return true;
    });
  }, [rows, search, filter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((u) => u.status === STATUS.ACTIVE).length,
      needsAction: rows.filter((u) => NEEDS_ACTION.includes(u.status)).length,
      otherApp: rows.filter((u) => u.status === STATUS.OTHER_APP).length,
    }),
    [rows]
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 rounded-xl">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้และสิทธิ์</h1>
              <p className="text-sm text-slate-500">แอปปัจจุบัน: {CURRENT_APP_ID}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/admin/superadmin/line-settings" className="btn btn-sm btn-outline border-slate-300 text-slate-600">💬 ตั้งค่า LINE</a>
            <a href="/admin/superadmin/audit-log" className="btn btn-sm btn-outline border-slate-300 text-slate-600">📜 Audit Log</a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "ทั้งหมด", value: counts.total, cls: "text-slate-600" },
            { icon: Building2, label: `ใช้งานได้ (${CURRENT_APP_ID})`, value: counts.active, cls: "text-emerald-600" },
            { icon: AlertTriangle, label: "ต้องดำเนินการ", value: counts.needsAction, cls: "text-amber-600" },
            { icon: Users, label: "แอปอื่น", value: counts.otherApp, cls: "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.cls}`} />
              <div>
                <div className="text-xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Clerk unavailable banner */}
        {clerkUnavailable && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
            ⚠️ ติดต่อ Clerk ไม่ได้ชั่วคราว — แสดงเฉพาะข้อมูลในระบบ ปุ่มเพิ่ม/ซ่อมถูกปิดไว้จนกว่าจะเชื่อมต่อได้
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา ชื่อ / email / กอง / clerkId..."
              className="input input-sm input-bordered w-full pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`btn btn-xs rounded-full ${filter === f.key ? "bg-slate-800 text-white border-0" : "btn-ghost text-slate-500"}`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => setBulkOpen(true)} className="btn btn-xs btn-outline border-slate-300 text-slate-600">
              <ListChecks className="w-3.5 h-3.5 mr-1" />ให้สิทธิ์เป็นชุด
            </button>
            <button onClick={fetchOverview} aria-label="รีเฟรช" className="btn btn-xs btn-ghost text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const key = rowKey(u);
              return (
                <UserRow
                  key={key}
                  u={u}
                  busy={!!busy[key]}
                  expanded={expandedKey === key}
                  clerkUnavailable={clerkUnavailable}
                  onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                  onOnboard={onboard}
                  onAssignApp={assignApp}
                  onRepair={repair}
                >
                  <PermissionEditor
                    role={u.role}
                    value={editedPages[u.mongoId] || []}
                    onChange={(next) => setEditedPages((prev) => ({ ...prev, [u.mongoId]: next }))}
                    onSave={() => savePages(u)}
                    saving={!!busy[key]}
                  />
                </UserRow>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-14 h-14 mx-auto mb-3 opacity-40" />
                <p>ไม่พบผู้ใช้ตามเงื่อนไข</p>
              </div>
            )}
          </div>
        )}
      </div>

      {bulkOpen && (
        <BulkGrantModal
          users={rows.filter((u) => u.status === STATUS.ACTIVE)}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); fetchOverview(); }}
        />
      )}
    </div>
  );
}
