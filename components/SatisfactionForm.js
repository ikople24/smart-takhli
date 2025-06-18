import React, { useState } from "react";
import Swal from "sweetalert2";

const SatisfactionForm = ({ onSubmit, complaintId }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmit = async () => {
    console.log("📦 Submitting Satisfaction:", { complaintId, rating, comment });

    if (rating === 0) {
      Swal.fire("กรุณาให้คะแนน", "โปรดเลือกคะแนนก่อนส่งแบบประเมิน", "warning");
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
  };

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
        >
          ส่งความคิดเห็น
        </button>
      </div>
    </form>
  );
};

export default SatisfactionForm;