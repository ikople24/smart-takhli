import { useState, useEffect } from "react";
import ComplaintFormModal from "./ComplaintFormModal";


const ComplaintCategoryList = () => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
  console.log("🚀 useEffect called, fetching menu...");
  fetch("/api/menu")
    .then((res) => res.json())
    .then((data) => {
      console.log("📦 เมนูที่ได้จาก API:", data);
      setCategories(data);
    })
    .catch((error) => {
      console.error("❌ Error loading menu:", error);
    });
}, []);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {categories.map((item) => (
          <div key={item._id} className="flex flex-col items-center space-y-2">
            <button
              onClick={() => setSelectedLabel(item.Prob_name)}
              className="w-full aspect-square rounded-full flex items-center justify-center bg-gray-200"
            >
              <img
                src={item.Prob_pic}
                alt={item.Prob_name}
                className="w-2/3 h-2/3 object-contain"
              />
            </button>
            <div className="text-xs sm:text-sm font-medium text-gray-800 text-center">
              {item.Prob_name}
            </div>
          </div>
        ))}
      </div>
      <ComplaintFormModal selectedLabel={selectedLabel} onClose={() => setSelectedLabel(null)} />
    </>
  );
};

export default ComplaintCategoryList;