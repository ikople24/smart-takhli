// components/complaints/manage/MobileManageView.jsx
// จอ 1 ของหน้าจัดการเรื่องบนมือถือ (md:hidden) — state ทั้งหมดอยู่ที่ pages/admin/manage-complaints.jsx
import { AdjustmentsHorizontalIcon, ClockIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import StatusTabs from "./StatusTabs";
import ComplaintMobileCard from "./ComplaintMobileCard";

export default function MobileManageView({
  tabs,
  statusFilter,
  onStatusChange,
  searchTerm,
  onSearchChange,
  activeFilterCount,
  onOpenFilters,
  staleCount,
  staleOnly,
  onToggleStale,
  items,
  totalCount,
  hasMore,
  onLoadMore,
  loading,
  cardHandlers,
}) {
  return (
    <section className="md:hidden" aria-label="รายการเรื่องร้องเรียน">
      <div className="sticky top-0 z-20 -mx-3 border-b border-gray-200 bg-white px-3 pt-2 pb-3">
        <StatusTabs tabs={tabs} value={statusFilter} onChange={onStatusChange} />
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
          <label className="block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="เลขคำร้อง, รายละเอียด, ชุมชน"
              aria-label="ค้นหาเรื่องร้องเรียน"
              className="block h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
          {searchTerm && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="ล้างคำค้น" className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-gray-400">
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={activeFilterCount > 0 ? `ตัวกรอง (ใช้อยู่ ${activeFilterCount} รายการ)` : "ตัวกรอง"}
            className="relative grid h-11 w-11 flex-none place-items-center rounded-xl border border-gray-200 bg-white text-gray-700"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-3">
        {staleCount > 0 && (
          <button
            type="button"
            onClick={onToggleStale}
            aria-pressed={staleOnly}
            className={clsx(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] text-orange-800",
              staleOnly ? "border-orange-300 bg-orange-100" : "border-orange-200 bg-orange-50"
            )}
          >
            <ClockIcon className="h-5 w-5 flex-none" aria-hidden />
            <span className="flex-1">
              <strong>{staleCount} เรื่อง</strong> ค้างนาน ไม่มีความคืบหน้า
            </span>
            <span className="font-semibold">{staleOnly ? "แสดงทั้งหมด" : "ดู"}</span>
          </button>
        )}

        <p role="status" className="px-1 text-xs text-gray-500">
          {loading ? "กำลังโหลด…" : `แสดง ${items.length} จาก ${totalCount} เรื่อง`}
        </p>

        {loading &&
          [0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="h-44 animate-pulse rounded-2xl bg-gray-200/70" />)}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            ไม่พบเรื่องตามเงื่อนไข — ลองเปลี่ยนแท็บหรือตัวกรอง
          </div>
        )}

        {!loading &&
          items.map((it) => (
            <ComplaintMobileCard
              key={it.complaint._id}
              complaint={it.complaint}
              state={it.state}
              officer={it.officer}
              ageText={it.ageText}
              isStale={it.isStale}
              {...cardHandlers}
            />
          ))}

        {!loading && hasMore && (
          <button type="button" onClick={onLoadMore} className="h-11 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600">
            โหลดเพิ่ม (แสดง {items.length} จาก {totalCount})
          </button>
        )}
      </div>
    </section>
  );
}
