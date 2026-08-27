// components/superadmin/StatusBadge.jsx
// badge สถานะ user ในหน้า /admin/superadmin — mapping เดียวทั้งหน้า
import { STATUS } from "@/lib/superadmin/usersOverview";

const MAP = {
  [STATUS.BROKEN]: { label: "ข้อมูลพัง (stub)", cls: "bg-red-100 text-red-700" },
  [STATUS.ORPHAN]: { label: "บัญชี Clerk ถูกลบ", cls: "bg-red-100 text-red-700" },
  [STATUS.NO_DOC]: { label: "ยังไม่ลงทะเบียน", cls: "bg-sky-100 text-sky-700" },
  [STATUS.NO_APP]: { label: "รอกำหนด App", cls: "bg-amber-100 text-amber-800" },
  [STATUS.ACTIVE]: { label: null, cls: "bg-emerald-100 text-emerald-700" }, // โชว์ชื่อแอปแทน
  [STATUS.OTHER_APP]: { label: null, cls: "bg-slate-200 text-slate-600" }, // โชว์ชื่อแอปแทน
};

export default function StatusBadge({ status, appId }) {
  const m = MAP[status];
  if (!m) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      {m.label || appId}
    </span>
  );
}
