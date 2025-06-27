// AvailableItems.js
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowRight, ArrowLeft } from "lucide-react";

const skeletonCount = 6; // จำนวน skeleton ที่แสดงขณะโหลด

const AvailableItems = ({ menu = [], loading = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);

  useEffect(() => {
    fetch("/api/smart-health/available-devices")
      .then((res) => res.json())
      .then((data) => setAvailableDevices(data))
      .catch((err) => console.error("Error loading devices", err));
  }, []);

  return (
    <div className="mt-6 p-4 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">รายการพร้อมยืม</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-center">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-md p-3 w-full max-w-[130px] sm:max-w-[150px] flex flex-col items-center mx-auto animate-pulse"
              >
                <div className="skeleton h-14 w-14 mb-2 rounded-full bg-gray-300"></div>
                <div className="skeleton h-4 w-16 mb-1 rounded bg-gray-200"></div>
                <div className="skeleton h-3 w-10 mb-1 rounded bg-gray-100"></div>
                <div className="skeleton h-3 w-14 rounded bg-gray-100"></div>
              </div>
            ))
          : menu.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md p-3 w-full max-w-[130px] sm:max-w-[150px] flex flex-col items-center mx-auto"
              >
                <div className="w-14 h-14 relative">
                  <Image
                    src={item.image_icon || "/default-icon.png"}
                    alt={`icon of ${item.image_icon}`}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="mt-2 text-center font-semibold text-sm">{item.label}</div>
                {item.available > 0 ? (
                  <div className="text-green-600 text-sm mt-1">✅ พร้อมยืม</div>
                ) : (
                  <div className="text-red-500 text-sm mt-1">⛔️ ไม่พร้อมยืม</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {typeof item.available === "number" ? item.available : 0} รายการ
                </div>
              </div>
            ))}
      </div>
      <div className="mt-6 flex justify-center gap-4">
        <button
          className="btn btn-success flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <ArrowRight className="w-4 h-4" />
          ยืมอุปกรณ์
        </button>
        <button className="btn btn-warning flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          คืนอุปกรณ์
        </button>
      </div>
      {showModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">ฟอร์มยืมอุปกรณ์</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">เลขบัตรประชาชน</span>
                </label>
                <input type="text" placeholder="เลขบัตรประชาชน" className="input input-bordered w-full" />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">รหัสอุปกรณ์</span>
                </label>
                <select className="select select-bordered w-full">
                  <option value="">เลือกอุปกรณ์</option>
                  {availableDevices.map((device, i) => (
                    <option key={i} value={device.index_id_tk}>
                      {device.display_label || device.index_id_tk}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  <span className="label-text">วันที่และเวลา</span>
                </label>
                <input type="datetime-local" className="input input-bordered w-full" />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-primary">บันทึก</button>
              <button className="btn" onClick={() => setShowModal(false)}>ยกเลิก</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default AvailableItems;