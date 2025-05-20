import React from 'react'
import { useState } from 'react'

const ListButtonComplaint = () => {
  const [selectedProblems, setSelectedProblems] = useState([]);
  return (
    <div className="flex flex-col space-y-2 mt-4">
  <label className="text-sm font-medium text-gray-800">รายการปัญหาที่พบ</label>
  <div className="flex flex-wrap gap-2">
    {[
      "พื้นผิวถนนเสีย",
      "ไฟส่องสว่างดับ",
      "ขยะสะสม",
      "ท่อน้ำตัน",
      "เสียงดังรบกวน",
      "กลิ่นเหม็น",
    ].map((item) => (
      <button
        key={item}
        type="button"
        className={`px-4 py-1 rounded-full text-md shadow-sm transition-colors ${
          selectedProblems.includes(item)
            ? "bg-blue-500 text-white"
            : "bg-blue-100 text-blue-800"
        }`}
        onClick={() =>
          setSelectedProblems((prev) =>
            prev.includes(item)
              ? prev.filter((p) => p !== item)
              : [...prev, item]
          )
        }
      >
        {item}
      </button>
    ))}
  </div>
</div>
  )
}

export default ListButtonComplaint