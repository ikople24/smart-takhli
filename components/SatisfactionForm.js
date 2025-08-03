import React, { useState } from "react";
import Swal from "sweetalert2";
import { z } from "zod";

const SatisfactionForm = ({ onSubmit, complaintId, status }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zod schema สำหรับ validation
  const satisfactionFormSchema = z.object({
    rating: z.number().min(1, "กรุณาให้คะแนน"),
    comment: z.string().min(1, "กรุณากรอกความคิดเห็น"),
    complaintId: z.string().min(1, "ไม่พบรหัสเรื่องร้องเรียน"),
  });

  const handleSubmit = async () => {
    // ป้องกันการกดปุ่มซ้ำ
    if (isSubmitting) {
      return;
    }

    console.log("📦 Submitting Satisfaction:", { complaintId, rating, comment });

    // Validation ด้วย Zod
    const dataToValidate = {
      rating,
      comment: comment.trim(),
      complaintId,
    };

    const validationResult = satisfactionFormSchema.safeParse(dataToValidate);
    if (!validationResult.success) {
      // เรียงลำดับ error ตามความสำคัญ
      const errorOrder = [
        'rating',
        'comment',
        'complaintId'
      ];
      
      const sortedErrors = validationResult.error.errors.sort((a, b) => {
        const aIndex = errorOrder.indexOf(a.path[0]);
        const bIndex = errorOrder.indexOf(b.path[0]);
        return aIndex - bIndex;
      });
      
      const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
      Swal.fire("ข้อมูลไม่ครบถ้วน", errorMessages, "warning");
      return;
    }

    const result = await Swal.fire({
      title: "ยืนยันการส่งแบบประเมิน?",
      text: "คุณต้องการส่งความคิดเห็นนี้หรือไม่?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่, ส่งเลย!",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/satisfaction/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, rating, comment }),
      });

      if (res.ok) {
        Swal.fire("ส่งสำเร็จ", "ขอบคุณสำหรับความคิดเห็นของคุณ", "success");
        if (onSubmit) onSubmit();
      } else {
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถส่งความคิดเห็นได้", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถส่งความคิดเห็นได้", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ตรวจสอบสถานะก่อนแสดงฟอร์ม
  if (status !== "ดำเนินการเสร็จสิ้น") {
    return (
      <div className="text-center p-4 text-gray-500">
        <p>ไม่สามารถประเมินความพึงพอใจได้</p>
        <p className="text-sm">กรุณารอให้การดำเนินการเสร็จสิ้นก่อน</p>
      </div>
    );
  }

  return (
    <form>
      <div className="flex flex-col items-end">
        <div className="rating gap-1 animate-bounce ">
          {[1, 2, 3, 4, 5].map((star) => (
            <input
              key={star}
              type="radio"
              name="rating"
              value={star}
              onChange={() => setRating(star)}
              className="mask mask-star-2 bg-yellow-400 border-yellow-500 w-6 h-6 transition-all duration-300 ease-in-out hover:scale-110"
              aria-label={`${star} star`}
              title={`${star} ดาว`}
            />
          ))}
        </div>
        <p className="text-right mt-1 text-sm">ให้คะแนน: {rating}</p>

        <textarea
          className="textarea textarea-bordered w-full max-w-md mt-4"
          placeholder="แสดงความคิดเห็นเพิ่มเติม..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-primary btn-sm mt-4"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              กำลังส่ง...
            </>
          ) : (
            'ส่งความคิดเห็น'
          )}
        </button>
      </div>
    </form>
  );
};

export default SatisfactionForm;