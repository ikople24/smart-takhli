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
        setProblemOptions(filtered);
      });
  }, [category]);

  return (
    <div className="flex flex-col space-y-2 mt-4">
      <label className="text-sm font-medium text-gray-800">รายการปัญหาที่พบ</label>
      <div className="flex flex-wrap gap-2">
        {problemOptions.map((item) => (
          <button
            key={item._id}
            type="button"
            className={`px-4 py-1 rounded-full text-md shadow-sm transition-colors ${
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
            {item.icon ? <span className="mr-1">{item.icon}</span> : null}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ListButtonComplaint;