import { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import axios from "axios";
import CardModalDetail from "@/components/CardModalDetail";

const ComplaintListPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await axios.get("/api/complaints");
        setComplaints(res.data);
      } catch (err) {
        console.error("Error fetching complaints:", err);
      }
    };
    fetchComplaints();
  }, []);

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">รายการคำร้อง</h1>
      {complaints.map((item) => {
        const isExpanded = expandedIds.includes(item._id);
        return (
          <button key={item._id} onClick={() => setModalData(item)} className="text-left w-full">
            <div className="card mb-4 p-4 border rounded cursor-pointer">
              <h2 className="text-lg font-semibold">{item.title || item.problems?.[0]}</h2>
              {isExpanded && <p className="mt-2">{item.detail}</p>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(item._id);
                }}
                className="mt-2 btn btn-sm"
              >
                {isExpanded ? "ย่อ" : "ขยาย"}
              </button>
            </div>
          </button>
        );
      })}
      <CardModalDetail modalData={modalData} onClose={() => setModalData(null)} />
    </div>
  );
};

export default ComplaintListPage;