import Image from "next/image";
import ImageUploads from "./ImageUploads";
import { useState, useEffect } from "react";
import { useAdminOptionsStore } from "../stores/useAdminOptionsStore";
import { z } from "zod";

export default function UpdateAssignmentModal({ assignment, onClose }) {
  const [note, setNote] = useState(assignment.note || "");
  const [solution, setSolution] = useState(assignment.solution || []);
  const [solutionImages, setSolutionImages] = useState([]);
  const [completedAt, setCompletedAt] = useState(
    assignment.completedAt
      ? new Date(assignment.completedAt).toISOString().split("T")[0]
      : ""
  );
  const { adminOptions } = useAdminOptionsStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zod schema สำหรับ validation
  const assignmentUpdateSchema = z.object({
    note: z.string().min(1, "กรุณากรอกหมายเหตุ"),
    solution: z.array(z.string()).min(1, "กรุณาเลือกวิธีการแก้ไขอย่างน้อย 1 รายการ"),
    solutionImages: z.array(z.string()).optional(),
    completedAt: z.string().min(1, "กรุณาเลือกวันที่ดำเนินการเสร็จสิ้น"),
  });
  
  const handleRemoveImage = (indexToRemove) => {
    setSolutionImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    setNote(assignment.note || "");
    setSolution(Array.isArray(assignment.solution) ? assignment.solution : []);
    setSolutionImages(assignment.solutionImages || []);
    setCompletedAt(
      assignment.completedAt
        ? new Date(assignment.completedAt).toISOString().split("T")[0]
        : ""
    );
  }, [assignment]);

  useEffect(() => {
    const fetchAdminOptions = async () => {
      try {
        const res = await fetch("/api/admin-options");
        const data = await res.json();
        // console.log("Fetched raw admin-options:", data); // debug: log
        if (res.ok && Array.isArray(data)) {
          useAdminOptionsStore.getState().setAdminOptions(data);
        } else {
          console.error("Admin options response is invalid:", data);
        }
      } catch (error) {
        console.error("Error fetching admin options:", error);
      }
    };
    fetchAdminOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ป้องกันการกดปุ่มซ้ำ
    if (isSubmitting) {
      return;
    }

    // Validation ด้วย Zod
    const dataToValidate = {
      note: note.trim(),
      solution,
      solutionImages,
      completedAt,
    };

    const result = assignmentUpdateSchema.safeParse(dataToValidate);
    if (!result.success) {
      // เรียงลำดับ error ตามความสำคัญ
      const errorOrder = [
        'note',
        'solution',
        'completedAt',
        'solutionImages'
      ];
      
      const sortedErrors = result.error.errors.sort((a, b) => {
        const aIndex = errorOrder.indexOf(a.path[0]);
        const bIndex = errorOrder.indexOf(b.path[0]);
        return aIndex - bIndex;
      });
      
      const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
      alert("ข้อมูลไม่ครบถ้วน:\n" + errorMessages);
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Submitting assignment update", {
        assignmentId: assignment._id,
        note,
        solution,
        solutionImages,
        completedAt,
      });
      const res = await fetch("/api/assignments/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment._id,
          note,
          solution,
          solutionImages,
          completedAt,
        }),
      });

      if (!res.ok) throw new Error("Failed to update assignment");
      alert("อัปเดตงานสำเร็จ");
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error updating assignment:", err);
      alert("เกิดข้อผิดพลาดในการอัปเดต");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 min-w-[375px] shadow-xl">
        <h2 className="text-xl font-semibold mb-4">อัปเดตการดำเนินการ</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">
                1. วิธีการแก้ไข
              </span>
            </label>
            {/* {console.log("Assignment category:", assignment.category)} */}
            <div className="flex flex-wrap gap-2">
              {adminOptions
                .filter(
                  (opt) =>
                    opt.menu_category === assignment.category ||
                    solution.includes(opt.label)
                )
                .map((opt) => {
                  const isSelected = solution.includes(opt.label);
                  return (
                    <button
                      key={opt._id}
                      type="button"
                      className={`btn btn-md px-4 py-2 ${
                        isSelected ? "btn-info" : "btn-outline"
                      }`}
                      onClick={() =>
                        setSolution((prev) =>
                          prev.includes(opt.label)
                            ? prev.filter((item) => item !== opt.label)
                            : [...prev, opt.label]
                        )
                      }
                    >
                      <Image
                        src={opt.icon_url}
                        alt={opt.label}
                        width={28}
                        height={28}
                        className="w-7 h-7 mr-1"
                      />
                      {opt.label}
                    </button>
                  );
                })}
            </div>
          </div>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">
                2. หมายเหตุ
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows="4"
              className="textarea textarea-info textarea-bordered w-full"
            />
          </div>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">2. อัปโหลดภาพถ่าย</span>
            </label>
            <ImageUploads
              initialUrls={solutionImages}
              onChange={(urls) => setSolutionImages(urls)}
            />
            {solutionImages.length > 0 && (
              <div className="mt-2 space-y-2">
                <label className="label">
                  <span className="label-text text-sm font-medium text-gray-800">รูปภาพที่อัปโหลด</span>
                </label>
                {solutionImages.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Image
                      src={url}
                      alt={`Uploaded ${index + 1}`}
                      width={80}
                      height={80}
                      className="rounded border"
                    />
                    <input
                      type="text"
                      value={url}
                      readOnly
                      className="input input-bordered input-sm w-full text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="btn btn-xs btn-error"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">
                4. วันที่ดำเนินการเสร็จสิ้น
              </span>
            </label>
            <input
              type="date"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="input input-info input-bordered w-full"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={isSubmitting}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก'
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Override file input button label for localization */}
      <style jsx global>{`
        input[type="file"]::file-selector-button {
          content: "เลือกรูปภาพ";
        }
        input[type="file"]::-webkit-file-upload-button {
          visibility: hidden;
        }
        input[type="file"]::before {
          content: "เลือกรูปภาพ";
          display: inline-block;
          background: #00bfff;
          border: 1px solid #00bfff;
          padding: 0.4rem 0.75rem;
          outline: none;
          white-space: nowrap;
          cursor: pointer;
          font-weight: 500;
          color: white;
          border-radius: 0.375rem;
          font-size: 0.85rem;
          margin-right: 0.5rem;
          max-width: 120px;
        }
        input[type="file"]:hover::before {
          background: #00ace6;
        }
      `}</style>
    </dialog>
  );
}
