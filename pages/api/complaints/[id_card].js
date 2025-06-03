import { useState } from "react";
import CardModalDetail from "@/components/CardModalDetail";

export default function ComplaintList({ complaints }) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [modalData, setModalData] = useState(null);

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {complaints.map((item) => {
        return (
          <button key={item._id} onClick={() => setModalData(item)} className="text-left w-full">
            <div className="card p-4 mb-4 border rounded shadow">
              <h3 className="font-bold text-lg">{item.title || item.problems?.[0]}</h3>
              <p className="text-sm text-gray-600">{item.detail}</p>
              <p className="text-xs text-gray-400 mt-2">
                อัปเดตเมื่อ: {new Date(item.updatedAt).toLocaleDateString("th-TH")}
              </p>
            </div>
          </button>
        );
      })}

      <CardModalDetail modalData={modalData} onClose={() => setModalData(null)} />
    </div>
  );
}