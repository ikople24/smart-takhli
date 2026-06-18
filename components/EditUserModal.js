import React, { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
const LocationPickerModal = dynamic(() => import("./LocationPickerModal"), { ssr: false });

export default function EditUserModal({ isOpen, onClose, complaint }) {
  const [reporterInfo, setReporterInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedData, setEditedData] = useState({ location: null });

  useEffect(() => {
    if (complaint?._id && isOpen) {
      setLoading(true);
      axios
        .get(`/api/submittedreports/personal-info/${complaint._id}`)
        .then((res) => {
          setReporterInfo(res.data);
          setEditedData({ location: res.data.location || { lat: 15.0, lng: 100.0 } });
        })
        .catch((err) => console.error("Error fetching reporter info", err))
        .finally(() => setLoading(false));
    }
  }, [complaint, isOpen]);

  const handleLocationConfirm = async (newLocation) => {
    try {
      await axios.put(`/api/submittedreports/${complaint._id}`, {
        location: newLocation,
      });
      setReporterInfo((prev) => ({
        ...prev,
        location: newLocation,
      }));
      setIsEditingLocation(false);
    } catch (error) {
      console.error("Error updating location", error);
    }
  };

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
              <div className="mt-2">
                <fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-full border p-4 flex items-center">
                  <legend className="fieldset-legend">การตั้งค่าพิกัด</legend>
                  <label className="label w-full justify-between cursor-pointer">
                    <span className="label-text">กดสวิสเพื่อเปิดการใช้เครื่องมือแก้ไข</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={isEditingLocation}
                      onChange={() => setIsEditingLocation(!isEditingLocation)}
                    />
                  </label>
                </fieldset>
              </div>
              {isEditingLocation && (
                <div className="card p-4 mb-4 relative">
                  <div className="w-full">
                    <LocationPickerModal
                      initialLocation={editedData.location}
                      onConfirm={handleLocationConfirm}
                      onCancel={() => setIsEditingLocation(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p>ไม่พบข้อมูล</p>
          )}
        </div>
      </div>
    </div>
  );
}
