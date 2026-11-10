// components/complaints/manage/ComplaintActionsSheet.jsx
// จอ 3: คำสั่งรองของเรื่อง (ปุ่ม ⋯) — ใช้ทั้งมือถือ (bottom sheet) และ desktop (dialog)
// ทุก handler รับ complaint; ตัว sheet ปิดตัวเองก่อนเรียก handler ที่เปิดหน้า/ยืนยันอื่นต่อ
import clsx from "clsx";
import {
  CheckIcon,
  LockClosedIcon,
  MapPinIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import BottomSheet from "./BottomSheet";

const STATUS_PILL = {
  pending: ["รอมอบหมาย", "bg-amber-100 text-amber-800"],
  progress: ["กำลังดำเนินการ", "bg-blue-100 text-blue-700"],
  done: ["เสร็จสิ้น", "bg-emerald-100 text-emerald-800"],
};

function Item({ icon: Icon, tone, title, hint, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl px-2 text-left text-[15px] text-gray-900 hover:bg-gray-50 disabled:text-gray-500 disabled:hover:bg-transparent"
    >
      <span className={clsx("grid h-9 w-9 flex-none place-items-center rounded-[10px]", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex-1">
        {title}
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </button>
  );
}

function Toggle({ label, hint, checked, onChange, accent }) {
  return (
    <label className="flex min-h-[52px] items-center gap-3">
      <span className="flex-1 text-[15px]">
        {label}
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} className={clsx("h-[22px] w-[22px]", accent)} />
    </label>
  );
}

export default function ComplaintActionsSheet({
  complaint,
  state,
  isSuperAdmin,
  onClose,
  onAssign,
  onUpdate,
  onCloseComplaint,
  onOpenDetail,
  onToggleConfidential,
  onTogglePdpa,
  onDelete,
}) {
  const open = !!complaint;
  const run = (fn) => () => {
    onClose();
    fn(complaint);
  };
  const [statusLabel, statusCls] = STATUS_PILL[state] || STATUS_PILL.pending;

  return (
    <BottomSheet open={open} onClose={onClose} title="จัดการเรื่อง">
      {open && (
        <>
          <div className="-mt-1 mb-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-gray-700">{complaint.complaintId || "—"}</span>
              <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusCls)}>{statusLabel}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{complaint.detail}</p>
          </div>

          <nav aria-label="คำสั่ง" className="flex flex-col">
            {state === "pending" && (
              <Item icon={UserPlusIcon} tone="bg-blue-50 text-blue-600" title="รับเรื่อง" onClick={run(onAssign)} />
            )}
            {state === "progress" && (
              <>
                <Item icon={PencilSquareIcon} tone="bg-blue-50 text-blue-600" title="อัปเดตความคืบหน้า" hint="แนบรูป + บันทึกการดำเนินงาน (โอนเรื่องได้ในหน้านี้)" onClick={run(onUpdate)} />
                <Item icon={CheckIcon} tone="bg-emerald-50 text-emerald-700" title="ปิดเรื่อง" onClick={run(onCloseComplaint)} />
              </>
            )}
            <Item icon={MapPinIcon} tone="bg-gray-100 text-gray-700" title="ดูรายละเอียด / แผนที่" onClick={run(onOpenDetail)} />
          </nav>

          <div className="mt-1 border-t border-gray-100 pt-2.5">
            <p className="text-xs font-semibold text-gray-500">การแสดงผลต่อประชาชน</p>
            <Toggle
              label="เรื่องลับ"
              hint="ซ่อนจากหน้า ร้องเรียน / สถานะ"
              checked={!!complaint.isConfidential}
              onChange={() => onToggleConfidential(complaint)}
              accent="accent-rose-700"
            />
            <Toggle
              label="PDPA"
              hint="เบลอภาพ + เซ็นเซอร์คำ"
              checked={!!complaint.pdpaSensitive}
              onChange={() => onTogglePdpa(complaint)}
              accent="accent-amber-700"
            />
          </div>

          {state === "done" && (
            <div className="mt-1 border-t border-gray-100 pt-1.5">
              {isSuperAdmin ? (
                <Item icon={TrashIcon} tone="bg-red-50 text-red-600" title="ลบเรื่อง" onClick={run(onDelete)} />
              ) : (
                <Item icon={LockClosedIcon} tone="bg-gray-100 text-gray-500" title="ลบเรื่อง — เฉพาะ Super Admin" disabled />
              )}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
