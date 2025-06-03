import ImageUploads from "./ImageUploads";
import { useState, useEffect } from "react";

export default function UpdateAssignmentModal({ assignment, onClose }) {
  const [note, setNote] = useState(assignment.note || "");
  const [solution, setSolution] = useState(assignment.solution || "");
  const [solutionImages, setSolutionImages] = useState([]);
  const [completedAt, setCompletedAt] = useState(
    assignment.completedAt ? new Date(assignment.completedAt).toISOString().split("T")[0] : ""
  );

  useEffect(() => {
    setNote(assignment.note || "");
    setSolution(assignment.solution || "");
    setSolutionImages(assignment.solutionImages || []);
    setCompletedAt(
      assignment.completedAt
        ? new Date(assignment.completedAt).toISOString().split("T")[0]
        : ""
    );
  }, [assignment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    } catch (err) {
      console.error("Error updating assignment:", err);
      alert("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-100 min-w-[375px] shadow-xl">
        <h2 className="text-xl font-semibold mb-4">อัปเดตการดำเนินการ</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">1. วิธีการแก้ไข</span>
            </label>
            <input
              type="text"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              className="input input-info input-bordered w-full"
            />
          </div>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">2. หมายเหตุ</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows="4"
              className="textarea textarea-info textarea-bordered w-full"
            />
          </div>
      <div className="mb-4">
        <ImageUploads onChange={(urls) => setSolutionImages(urls)} />
      </div>
          <div className="mb-4">
            <label className="label">
              <span className="label-text text-sm font-medium text-gray-800">4. วันที่ดำเนินการเสร็จสิ้น</span>
            </label>
            <input
              type="date"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="input input-info input-bordered w-full"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              บันทึก
            </button>
          </div>
        </form>
      </div>
      {/* Override file input button label for localization */}
      <style jsx global>{`
        input[type="file"]::file-selector-button {
          content: 'เลือกรูปภาพ';
        }
        input[type="file"]::-webkit-file-upload-button {
          visibility: hidden;
        }
        input[type="file"]::before {
          content: 'เลือกรูปภาพ';
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