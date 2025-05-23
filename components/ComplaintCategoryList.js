import { useState, useEffect } from "react";
import ComplaintFormModal from "./ComplaintFormModal";


const ComplaintCategoryList = () => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [categories, setCategories] = useState([]);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
  console.log("🚀 useEffect called, fetching menu...");
  fetch("/api/menu")
    .then((res) => res.json())
    .then((data) => {
      // console.log("📦 เมนูที่ได้จาก API:", data);
      setCategories(data);
    })
    .catch((error) => {
      console.error("❌ Error loading menu:", error);
    });
}, []);

  const sortedCategories = [...categories].sort((a, b) => {
    if (a.order === 6) return 1;
    if (b.order === 6) return -1;
    return (a.order || 0) - (b.order || 0);
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {sortedCategories.map((item) => (
          <div key={item._id} className="flex flex-col items-center space-y-2">
            <button
              onClick={() => setSelectedLabel(item.Prob_name)}
              className="w-full aspect-square rounded-full overflow-hidden transition-transform duration-200 ease-in-out hover:scale-105"
            >
              <img
                src={item.Prob_pic}
                alt={item.Prob_name}
                className="w-full h-full object-cover"
              />
            </button>
            <div className="text-sm sm:text-base font-medium text-gray-800 text-center">
              {item.Prob_name}
            </div>
          </div>
        ))}
      </div>
      <ComplaintFormModal
        key={formKey}
        selectedLabel={selectedLabel}
        onClose={() => setSelectedLabel(null)}
        onSuccess={() => {
          setSelectedLabel(null);
          setFormKey((prev) => prev + 1);
        }}
      />
    </>
  );
};

export default ComplaintCategoryList;