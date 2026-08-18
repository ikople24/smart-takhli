// components/citizen/report/StepDetails.tsx
// ขั้น 2: ชุมชน + รายการปัญหา (chips multi) + แนบรูป ≤3
// reuse CommunitySelector / ImageUploads เดิมทั้งดุ้น — เขียนใหม่เฉพาะ chips
import CommunitySelector from "@/components/complaints/CommunitySelector";
import ImageUploads from "@/components/ImageUploads";

type ProblemOption = { _id: string; label: string; category: string; iconUrl?: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] font-medium text-[#DC2626]">{message}</p>;
}

export default function StepDetails({
  category,
  community,
  onCommunity,
  problemOptions,
  selectedProblems,
  onToggleProblem,
  onImages,
  onUploading,
  errors,
}: {
  category: string;
  community: string;
  onCommunity: (c: string) => void;
  problemOptions: ProblemOption[];
  selectedProblems: string[];
  onToggleProblem: (id: string) => void;
  onImages: (urls: string[]) => void;
  onUploading: (v: boolean) => void;
  errors: Record<string, string>;
}) {
  const options = problemOptions.filter((o) => o.category === category);

  return (
    <div className="flex-1 overflow-auto px-4 pb-4">
      <label className="mx-0.5 mb-2 mt-1.5 block text-[13px] font-semibold">
        ชุมชน <span className="text-[#EF4444]">*</span>
      </label>
      <div className="[&_select]:w-full">
        <CommunitySelector selected={community} onSelect={onCommunity} error={undefined} />
      </div>
      <FieldError message={errors.community} />

      <label className="mx-0.5 mb-2.5 mt-4 block text-[13px] font-semibold">
        รายการปัญหา <span className="font-normal text-[#9590A8]">(เลือกได้หลายข้อ)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = selectedProblems.includes(opt._id);
          return (
            <button
              key={opt._id}
              type="button"
              onClick={() => onToggleProblem(opt._id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] ${
                selected
                  ? "bg-[#7C3AED] font-medium text-white"
                  : "border border-[#E4DEF2] bg-white text-[#4A4458]"
              }`}
            >
              {selected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4 4L19 6" />
                </svg>
              )}
              {opt.label}
            </button>
          );
        })}
        {options.length === 0 && <p className="text-[12px] text-[#9590A8]">ไม่มีรายการปัญหาของหมวดนี้</p>}
      </div>
      <FieldError message={errors.selectedProblems} />

      <label className="mx-0.5 mb-2.5 mt-5 block text-[13px] font-semibold">
        แนบรูปภาพ <span className="font-normal text-[#9590A8]">(ไม่เกิน 3 รูป)</span>
      </label>
      <ImageUploads onChange={onImages} onUploadingChange={onUploading} />
      <FieldError message={errors.imageUrls} />
    </div>
  );
}
