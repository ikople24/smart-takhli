// components/superadmin/PermissionEditor.jsx
// ตัวแก้ allowedPages ของ user 1 คน — จัดกลุ่มตาม category + preset
// props:
//   role     role ใน Mongo ของ user (ใช้โชว์/ใส่ค่า default)
//   value    string[] — allowedPages ที่กำลังแก้ (ว่าง = ใช้ default)
//   onChange(nextPages)  onSave()  saving
import { Briefcase, Check, X, Save, RotateCcw } from "lucide-react";
import {
  ALL_PAGES, DEFAULT_PERMISSIONS, CATEGORY_LABELS,
  groupPagesByCategory, getExecutivePagePaths,
} from "@/lib/permissions";

const CATEGORY_ORDER = ["management", "reports", "settings", "user"];

export default function PermissionEditor({ role, value, onChange, onSave, saving }) {
  const groups = groupPagesByCategory(ALL_PAGES);
  const defaults = DEFAULT_PERMISSIONS[role] || [];
  const usingDefault = value.length === 0;

  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => groups[c]?.length),
    ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const toggle = (path) =>
    onChange(value.includes(path) ? value.filter((p) => p !== path) : [...value, path]);

  const toggleCategory = (pages) => {
    const paths = pages.map((p) => p.path);
    const allOn = paths.every((p) => value.includes(p));
    onChange(allOn ? value.filter((p) => !paths.includes(p)) : [...new Set([...value, ...paths])]);
  };

  return (
    <div className="border-t border-slate-200 p-4 bg-slate-50">
      {usingDefault && (
        <div className="mb-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
          ตอนนี้ใช้<strong>ค่า default ตาม role &quot;{role}&quot;</strong> ({defaults.length} หน้า) —
          ติ๊กหน้าใดก็ตามจะเปลี่ยนเป็นสิทธิ์กำหนดเอง และ default จะไม่มีผลอีก
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => onChange(getExecutivePagePaths())}
          title="เห็นทุกโมดูลยกเว้นการตั้งค่า"
          className="btn btn-xs bg-amber-500 hover:bg-amber-600 text-white border-0">
          <Briefcase className="w-3 h-3 mr-1" />ผู้บริหาร
        </button>
        <button onClick={() => onChange([...defaults])}
          title={`ใส่ชุด default ของ role ${role} เป็นสิทธิ์กำหนดเอง`}
          className="btn btn-xs bg-sky-600 hover:bg-sky-700 text-white border-0">
          <RotateCcw className="w-3 h-3 mr-1" />ค่า default ตาม role
        </button>
        <button onClick={() => onChange(ALL_PAGES.map((p) => p.path))}
          className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0">
          <Check className="w-3 h-3 mr-1" />เลือกหมด
        </button>
        <button onClick={() => onChange([])}
          title="ล้างเป็นลิสต์ว่าง = กลับไปใช้ค่า default ตาม role"
          className="btn btn-xs btn-outline border-slate-300 text-slate-600">
          <X className="w-3 h-3 mr-1" />ล้าง (ใช้ default)
        </button>
      </div>

      <div className="space-y-4 mb-4">
        {orderedCats.map((cat) => (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-slate-600">{CATEGORY_LABELS[cat]}</h5>
              <button onClick={() => toggleCategory(groups[cat])}
                className="text-xs text-sky-600 hover:underline">
                ติ๊ก/เอาออกทั้งหมวด
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groups[cat].map((page) => {
                const on = value.includes(page.path);
                return (
                  <button key={page.path} onClick={() => toggle(page.path)}
                    className={`p-2 rounded-lg text-left text-sm border transition-colors ${
                      on
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}>
                    <span className="mr-2">{page.icon}</span>
                    {page.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSave} disabled={saving}
        className="btn btn-sm bg-slate-800 hover:bg-slate-900 text-white border-0">
        {saving ? <span className="loading loading-spinner loading-sm" /> : <Save className="w-4 h-4 mr-1" />}
        บันทึกสิทธิ์
      </button>
    </div>
  );
}
