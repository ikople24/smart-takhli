// components/superadmin/UserRow.jsx
// แถว user 1 คนในหน้า /admin/superadmin — ปุ่ม action เปลี่ยนตาม status
// props:
//   u              OverviewUser จาก users-overview
//   busy           boolean — action ของแถวนี้กำลังทำงาน
//   expanded       boolean — ตัวแก้สิทธิ์กางอยู่
//   clerkUnavailable  boolean — ปิดปุ่มที่ต้องพึ่งข้อมูล Clerk
//   onToggle()     กาง/หุบตัวแก้สิทธิ์ (เฉพาะ active)
//   onOnboard(u) onAssignApp(u) onRepair(u, action)  — ดู index.jsx; ผู้เรียก (index.jsx) ต้องยืนยัน (Swal) ก่อนเสมอสำหรับ action ลบ
//   children       ตัวแก้สิทธิ์ (แสดงเมื่อ expanded)
import { ChevronDown, ChevronUp, UserPlus, Building2, Wrench, Trash2 } from "lucide-react";
import { STATUS } from "@/lib/superadmin/usersOverview";
import StatusBadge from "./StatusBadge";

function Avatar({ u }) {
  if (u.imageUrl) {
    return <img src={u.imageUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold">
      {(u.name || u.email || "?").charAt(0)}
    </div>
  );
}

function lastSeen(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
}

export default function UserRow({
  u, busy, expanded, clerkUnavailable,
  onToggle, onOnboard, onAssignApp, onRepair, children,
}) {
  const expandable = u.status === STATUS.ACTIVE;
  const spinner = <span className="loading loading-spinner loading-xs" />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div
        className={`p-4 flex items-center justify-between gap-3 ${expandable ? "cursor-pointer hover:bg-slate-50" : ""}`}
        onClick={expandable ? onToggle : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar u={u} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 truncate">
                {u.name || <span className="italic text-slate-400">(ไม่มีชื่อ)</span>}
              </span>
              <StatusBadge status={u.status} appId={u.appId} />
              {u.clerkBlocksApp && (
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                  title="Clerk allowedApps ของบัญชีนี้ไม่รวมแอปปัจจุบัน — ต่อให้สถานะในระบบใช้งานได้ ผู้ใช้จะล็อกอินแอปนี้ไม่ผ่าน (แก้ที่ Clerk Dashboard)"
                >
                  ⚠ Clerk ไม่อนุญาตแอปนี้
                </span>
              )}
              {u.clerkRole === "superadmin" && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">superadmin</span>
              )}
            </div>
            <div className="text-sm text-slate-500 truncate">
              {[u.email, u.position, u.department].filter(Boolean).join(" · ") || u.clerkId}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {lastSeen(u.lastSignInAt) && (
            <span className="hidden md:inline text-xs text-slate-400">เข้าล่าสุด {lastSeen(u.lastSignInAt)}</span>
          )}

          {u.status === STATUS.NO_DOC && (
            <button onClick={() => onOnboard(u)} disabled={busy || clerkUnavailable}
              className="btn btn-sm bg-sky-600 hover:bg-sky-700 text-white border-0">
              {busy ? spinner : <><UserPlus className="w-4 h-4 mr-1" />เพิ่มเข้าระบบ</>}
            </button>
          )}
          {u.status === STATUS.BROKEN && (
            <>
              <button onClick={() => onRepair(u, "fill_name")} disabled={busy || clerkUnavailable}
                className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-0">
                {busy ? spinner : <><Wrench className="w-4 h-4 mr-1" />เติมชื่อจาก Clerk</>}
              </button>
              {u.isStub && (
                <button onClick={() => onRepair(u, "delete_stub")} disabled={busy || clerkUnavailable}
                  className="btn btn-sm btn-outline border-red-300 text-red-600 hover:bg-red-50">
                  {busy ? spinner : <><Trash2 className="w-4 h-4 mr-1" />ลบ stub</>}
                </button>
              )}
            </>
          )}
          {u.status === STATUS.ORPHAN && (
            <button onClick={() => onRepair(u, "delete_orphan")} disabled={busy || clerkUnavailable}
              className="btn btn-sm btn-outline border-red-300 text-red-600 hover:bg-red-50">
              {busy ? spinner : <><Trash2 className="w-4 h-4 mr-1" />ลบ (บัญชีถูกลบแล้ว)</>}
            </button>
          )}
          {u.status === STATUS.NO_APP && (
            <button onClick={() => onAssignApp(u)} disabled={busy}
              className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-0">
              {busy ? spinner : <><Building2 className="w-4 h-4 mr-1" />กำหนด App</>}
            </button>
          )}
          {expandable && (
            <button type="button" aria-expanded={expanded} aria-label="กาง/หุบสิทธิ์"
              className="text-slate-400 cursor-pointer" onClick={onToggle}>
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && children}
    </div>
  );
}
