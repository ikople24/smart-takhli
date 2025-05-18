import { useState } from "react";
import ComplaintFormModal from "./ComplaintFormModal";

const categories = [
  { label: "ไฟฟ้าส่องสว่าง", color: "bg-red-500" },
  { label: "น้ำประปา", color: "bg-blue-500" },
  { label: "ถนน/ทางเท้า", color: "bg-yellow-500" },
  { label: "ขยะมูลฝอย", color: "bg-green-500" },
  { label: "สวัสดิการสังคม", color: "bg-pink-500" },
  { label: "อื่น ๆ", color: "bg-purple-500 col-span-2" },
];

const ComplaintCategoryList = () => {
  const [selectedLabel, setSelectedLabel] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {categories.map((item) => (
          <div key={item.label} className="flex flex-col items-center space-y-2">
            <button
              onClick={() => setSelectedLabel(item.label)}
              className={`w-full aspect-square rounded-full flex items-center justify-center ${item.color}`}
            >
              {/* สามารถใส่รูปภาพ/ไอคอนตรงนี้ได้ */}
            </button>
            <div className="text-xs sm:text-sm font-medium text-gray-800 text-center">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <ComplaintFormModal selectedLabel={selectedLabel} onClose={() => setSelectedLabel(null)} />
    </>
  );
};

export default ComplaintCategoryList;