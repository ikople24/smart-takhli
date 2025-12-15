import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  PackageCheck,
  CreditCard,
  Package,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import Swal from "sweetalert2";

export default function ReturnModal({ onClose, onSuccess }) {
  const [citizenId, setCitizenId] = useState("");
  const [borrowedItems, setBorrowedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [menuIcons, setMenuIcons] = useState([]);
  const [returningId, setReturningId] = useState(null);

  // Fetch menu icons for device images
  useEffect(() => {
    const fetchMenuIcons = async () => {
      try {
        const res = await fetch("/api/smart-health/menu-ob-health");
        const data = await res.json();
        setMenuIcons(data);
      } catch (err) {
        console.error("Error fetching menu icons:", err);
      }
    };
    fetchMenuIcons();
  }, []);

  const getIconUrl = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find((menu) => menu.id_code_th === code);
    return match?.image_icon || "";
  };

  const getObjectName = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find((menu) => menu.id_code_th === code);
    return match?.shot_name || "อุปกรณ์";
  };

  const handleSearch = async () => {
    if (!citizenId || citizenId.length < 5) {
      Swal.fire({
        icon: "warning",
        title: "กรุณากรอกเลขบัตรประชาชน",
        text: "กรอกเลขบัตรประชาชนอย่างน้อย 5 หลัก",
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(
        `/api/smart-health/active-borrows?citizenId=${citizenId}`
      );
      const data = await response.json();
      setBorrowedItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch borrows:", error);
      setBorrowedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (item) => {
    const result = await Swal.fire({
      title: "ยืนยันการคืนอุปกรณ์",
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p style="margin-bottom: 8px;"><strong>อุปกรณ์:</strong> ${getObjectName(item.index_id_tk)}</p>
          <p style="margin-bottom: 8px;"><strong>รหัส:</strong> ${item.index_id_tk}</p>
          <p><strong>วันที่ยืม:</strong> ${item.date_lend}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ยืนยันคืน",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    setReturningId(item.id_use_object);

    try {
      const response = await fetch("/api/smart-health/return-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrowId: item.id_use_object }),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "คืนอุปกรณ์สำเร็จ!",
          text: `คืน ${getObjectName(item.index_id_tk)} เรียบร้อยแล้ว`,
          showConfirmButton: false,
          timer: 2000,
        });

        // Remove from list
        setBorrowedItems((prev) =>
          prev.filter((b) => b.id_use_object !== item.id_use_object)
        );

        // Callback to refresh parent data
        onSuccess?.();
      } else {
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: data.message || "ไม่สามารถคืนอุปกรณ์ได้",
        });
      }
    } catch (error) {
      console.error("Return error:", error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์",
      });
    } finally {
      setReturningId(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleReset = () => {
    setCitizenId("");
    setBorrowedItems([]);
    setSearched(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">คืนอุปกรณ์</h3>
              <p className="text-xs text-gray-500">ค้นหาและคืนอุปกรณ์ที่ยืม</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Search Section */}
          {!searched || borrowedItems.length === 0 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  เลขบัตรประชาชน
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="กรอกเลขบัตรประชาชน"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-lg"
                      value={citizenId}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        if (value.length <= 13) {
                          setCitizenId(value);
                        }
                      }}
                      onKeyPress={handleKeyPress}
                      maxLength={13}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={loading || citizenId.length < 5}
                    className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                      loading || citizenId.length < 5
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg"
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">กรอกอย่างน้อย 5 หลัก</span>
                  <span className={`text-xs ${citizenId.length >= 5 ? "text-green-600" : "text-gray-400"}`}>
                    {citizenId.length}/13
                  </span>
                </div>
              </div>

              {/* Result: No items found */}
              {searched && borrowedItems.length === 0 && !loading && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    ไม่มีอุปกรณ์ที่ต้องคืน
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    ไม่พบรายการยืมที่ยังไม่ได้คืน
                  </p>
                  <button
                    onClick={handleReset}
                    className="text-orange-600 hover:underline text-sm"
                  >
                    ค้นหาใหม่
                  </button>
                </div>
              )}

              {/* Tips */}
              {!searched && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <h4 className="font-medium text-orange-800 mb-2 text-sm">
                    💡 วิธีใช้งาน
                  </h4>
                  <ul className="text-xs text-orange-700 space-y-1">
                    <li>• กรอกเลขบัตรประชาชนของผู้ยืม</li>
                    <li>• ระบบจะแสดงรายการอุปกรณ์ที่ยืมอยู่</li>
                    <li>• กดปุ่มคืนเพื่อทำการคืนอุปกรณ์</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Borrowed Items List */
            <div className="space-y-4">
              {/* Back Button */}
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                ค้นหาใหม่
              </button>

              {/* Result Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {citizenId.slice(0, 3)}****{citizenId.slice(-4)}
                  </span>
                </div>
                <span className="text-sm font-medium text-orange-600">
                  {borrowedItems.length} รายการ
                </span>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {borrowedItems.map((item) => {
                  const iconUrl = getIconUrl(item.index_id_tk);
                  const objectName = getObjectName(item.index_id_tk);
                  const isReturning = returningId === item.id_use_object;

                  return (
                    <div
                      key={item._id || item.id_use_object}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                    >
                      {/* Device Image */}
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 p-2">
                        {iconUrl ? (
                          <Image
                            src={iconUrl}
                            alt={objectName}
                            width={40}
                            height={40}
                            className="object-contain"
                            unoptimized
                          />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      {/* Device Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {objectName}
                        </h4>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {item.index_id_tk}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.date_lend}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                            <AlertCircle className="w-2.5 h-2.5" />
                            ยืมอยู่
                          </span>
                        </div>
                      </div>

                      {/* Return Button */}
                      <button
                        onClick={() => handleReturn(item)}
                        disabled={isReturning}
                        className={`
                          flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0
                          ${isReturning
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-md"
                          }
                        `}
                      >
                        {isReturning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <PackageCheck className="w-4 h-4" />
                            คืน
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition-colors font-medium"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
