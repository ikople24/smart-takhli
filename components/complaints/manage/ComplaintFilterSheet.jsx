// components/complaints/manage/ComplaintFilterSheet.jsx
// จอ 2: ตัวกรองรอง — แก้ใน draft ก่อน กด "แสดง N เรื่อง" ค่อย apply
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import BottomSheet from "./BottomSheet";
import { SORT_OPTIONS, DEFAULT_SORT } from "@/lib/complaints/manageList";

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "h-10 rounded-full border px-4 text-sm",
        active ? "border-blue-600 bg-blue-50 font-semibold text-blue-700" : "border-gray-200 bg-white text-gray-700"
      )}
    >
      {children}
    </button>
  );
}

export default function ComplaintFilterSheet({
  open,
  onClose,
  value, // { fiscalYear, category, sort, mineOnly, staleOnly }
  defaultFiscalYear,
  fiscalYearOptions,
  categories,
  countFor, // (draft) => number
  onApply,
}) {
  const [draft, setDraft] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (open) setDraft(valueRef.current);
  }, [open]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const reset = () =>
    setDraft({ fiscalYear: defaultFiscalYear, category: "all", sort: DEFAULT_SORT, mineOnly: false, staleOnly: false });
  const count = open ? (countFor(draft) ?? 0) : 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="ตัวกรอง"
      headerAction={
        <button type="button" onClick={reset} className="h-11 px-3 text-sm font-semibold text-blue-600">
          ล้างทั้งหมด
        </button>
      }
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-700">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-12 flex-[2] rounded-xl bg-blue-600 text-[15px] font-semibold text-white"
          >
            แสดง {count.toLocaleString()} เรื่อง
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-gray-600">ปีงบประมาณ</legend>
          <div className="flex flex-wrap gap-2">
            {fiscalYearOptions.map((fy) => (
              <Chip key={fy} active={String(draft.fiscalYear) === String(fy)} onClick={() => set({ fiscalYear: fy })}>
                {fy}
              </Chip>
            ))}
            <Chip active={draft.fiscalYear === "all"} onClick={() => set({ fiscalYear: "all" })}>
              ทุกปี
            </Chip>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-gray-600">หมวดหมู่</legend>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.category === "all"} onClick={() => set({ category: "all" })}>
              ทั้งหมด
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={draft.category === c} onClick={() => set({ category: c })}>
                {c}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-gray-600">เรียงตาม</legend>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            {SORT_OPTIONS.map((o, i) => (
              <label key={o.value} className={clsx("flex min-h-12 items-center gap-3 px-3.5 text-[15px]", i > 0 && "border-t border-gray-100")}>
                <input
                  type="radio"
                  name="complaint-sort"
                  checked={draft.sort === o.value}
                  onChange={() => set({ sort: o.value })}
                  className="h-5 w-5 accent-blue-600"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col">
          <label className="flex min-h-12 items-center gap-3 text-[15px]">
            <span className="flex-1">เฉพาะเรื่องที่ฉันรับผิดชอบ</span>
            <input type="checkbox" checked={draft.mineOnly} onChange={(e) => set({ mineOnly: e.target.checked })} className="h-[22px] w-[22px] accent-blue-600" />
          </label>
          <label className="flex min-h-12 items-center gap-3 text-[15px]">
            <span className="flex-1">เฉพาะเรื่องค้างนาน</span>
            <input type="checkbox" checked={draft.staleOnly} onChange={(e) => set({ staleOnly: e.target.checked })} className="h-[22px] w-[22px] accent-blue-600" />
          </label>
        </div>
      </div>
    </BottomSheet>
  );
}
