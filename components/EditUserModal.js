import React, { useEffect, useState } from "react";
import axios from "axios";

export default function EditUserModal({ isOpen, onClose, complaint }) {
  const [reporterInfo, setReporterInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (complaint?._id && isOpen) {
      setLoading(true);
      axios
        .get(`/api/submittedreports/personal-info/${complaint._id}`)
        .then((res) => {
          console.log("Reporter Info Fetched:", res.data);
          setReporterInfo(res.data);
        })
        .catch((err) => console.error("Error fetching reporter info", err))
        .finally(() => setLoading(false));
    }
  }, [complaint, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="text-xl font-bold mb-4">ข้อมูลผู้แจ้ง</h2>
        <div>
          {/* ใส่ฟอร์มแก้ไขตรงนี้ */}
          {loading ? (
            <p>กำลังโหลด...</p>
          ) : reporterInfo ? (
            <div className="bg-gray-50 p-4 rounded-md shadow-md">
              <p className="text-sm text-gray-500 mb-1">
                Complaint ID:{" "}
                <span className="font-mono">{complaint?._id}</span>
              </p>
              <p className="text-lg font-semibold">
                ชื่อผู้แจ้ง 👤 : {reporterInfo.fullName}
              </p>
              <p className="text-lg">เบอร์โทร 📞 : {reporterInfo.phone}</p>
              <p className="text-lg">
                📍พิกัด:
                <span className="font-mono">
                  {" "}
                  {reporterInfo.location?.lat?.toFixed(5)},{" "}
                  {reporterInfo.location?.lng?.toFixed(5)}
                </span>
              </p>
            </div>
          ) : (
            <p>ไม่พบข้อมูล</p>
          )}
        </div>
      </div>
    </div>
  );
}
