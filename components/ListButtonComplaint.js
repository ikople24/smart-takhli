import { useEffect, useState } from 'react';

const ListButtonComplaint = ({ category, selectedProblems, setSelectedProblems }) => {
  const [problemOptions, setProblemOptions] = useState([]);

  useEffect(() => {
    
    fetch(`/api/problems?category=${encodeURIComponent(category)}`)
      .then(res => res.json())
      .then(data => {
        
        const filtered = Array.isArray(data)
          ? data.filter(item => item.category === category)
          : [];
        const sorted = filtered.sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });
        setProblemOptions(sorted);
      });
  }, [category]);
  

  return (
    <div className="flex flex-col space-y-2 mt-4">
      <label className="text-sm font-medium text-gray-800">2.รายการปัญหาที่พบ (เลือกได้มากกว่า1)</label>
      <div className="flex flex-wrap gap-2">
        {problemOptions.map((item) => (
          <button
            key={item._id}
            type="button"
            className={`px-4 py-1 rounded-full text-md shadow-sm transition-colors flex items-center gap-2 ${
              selectedProblems.includes(item.label)
                ? "bg-blue-500 text-white"
                : "bg-blue-100 text-blue-800"
            }`}
            onClick={() =>
              setSelectedProblems((prev) =>
                prev.includes(item.label)
                  ? prev.filter((p) => p !== item.label)
                  : [...prev, item.label]
              )
            }
          >
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ListButtonComplaint;