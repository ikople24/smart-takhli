import React, { useState } from "react";
import Swal from "sweetalert2";
import { z } from "zod";
import { Star, Send } from "lucide-react";

const SatisfactionForm = ({ onSubmit, complaintId, status }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratingLabels = {
    1: "ต้องปรับปรุง",
    2: "พอใช้",
    3: "ปานกลาง",
    4: "ดี",
    5: "ดีมาก"
  };

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
    <form className="bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 rounded-2xl p-4 border border-pink-100 shadow-sm">
      <div className="flex flex-col">
        {/* Star Rating Section */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">ให้คะแนนความพึงพอใจ</p>
          
          {/* Star Buttons */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                  ${(hoverRating || rating) >= star 
                    ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30 scale-110" 
                    : "bg-white text-gray-300 border border-gray-200 hover:border-yellow-300"
                  }
                `}
              >
                <Star 
                  size={24} 
                  className={(hoverRating || rating) >= star ? "fill-current" : ""} 
                />
              </button>
            ))}
          </div>

          {/* Rating Label */}
          <div className="text-center mt-3 h-6">
            {(hoverRating || rating) > 0 && (
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                ${(hoverRating || rating) >= 4 ? "bg-green-100 text-green-700" :
                  (hoverRating || rating) >= 3 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"}
              `}>
                {rating > 0 && <span className="mr-1">{rating} ดาว -</span>}
                {ratingLabels[hoverRating || rating]}
              </span>
            )}
          </div>
        </div>

        {/* Comment Section */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">ความคิดเห็นเพิ่มเติม</label>
          <textarea
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none transition-all resize-none text-sm"
            placeholder="บอกเล่าประสบการณ์ของคุณ..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className={`
            w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200
            ${isSubmitting || rating === 0
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-[1.02]"
            }
          `}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              กำลังส่ง...
            </>
          ) : (
            <>
              <Send size={16} />
              ส่งความคิดเห็น
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default SatisfactionForm;