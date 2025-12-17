import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Search,
  PackageCheck,
  User,
  CreditCard,
  Package,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import Swal from "sweetalert2";

export default function SmartHealthReturnPage() {
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
        <div class="text-left">
          <p class="mb-2"><strong>อุปกรณ์:</strong> ${getObjectName(item.index_id_tk)}</p>
          <p class="mb-2"><strong>รหัส:</strong> ${item.index_id_tk}</p>
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

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              คืนอุปกรณ์
            </h1>
            <p className="text-gray-500 text-sm">
              กรอกเลขบัตรประชาชนเพื่อค้นหาอุปกรณ์ที่ยืม
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">ค้นหาผู้ยืม</h2>
              <p className="text-xs text-gray-500">
                กรอกเลขบัตรประชาชนของผู้ที่ต้องการคืนอุปกรณ์
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-lg"
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
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              ค้นหา
            </button>
          </div>

          {citizenId && (
            <div className="mt-3 text-sm text-gray-500">
              {citizenId.length}/13 หลัก
            </div>
          )}
        </div>

        {/* Results */}
        {searched && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Results Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-700">
                    ผลการค้นหา
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {borrowedItems.length} รายการที่ยังไม่ได้คืน
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">กำลังค้นหา...</p>
              </div>
            ) : borrowedItems.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  ไม่มีอุปกรณ์ที่ต้องคืน
                </h3>
                <p className="text-gray-500 text-sm">
                  ไม่พบรายการยืมอุปกรณ์ที่ยังไม่ได้คืน
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {borrowedItems.map((item) => {
                  const iconUrl = getIconUrl(item.index_id_tk);
                  const objectName = getObjectName(item.index_id_tk);
                  const isReturning = returningId === item.id_use_object;

                  return (
                    <div
                      key={item._id || item.id_use_object}
                      className="p-4 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Device Image */}
                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 p-2">
                          {iconUrl ? (
                            <Image
                              src={iconUrl}
                              alt={objectName}
                              width={48}
                              height={48}
                              className="object-contain"
                              unoptimized
                            />
                          ) : (
                            <Package className="w-8 h-8 text-gray-400" />
                          )}
                        </div>

                        {/* Device Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">
                            {objectName}
                          </h3>
                          <p className="text-sm text-gray-500 font-mono">
                            {item.index_id_tk}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              ยืมเมื่อ: {item.date_lend}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <AlertCircle className="w-3 h-3" />
                              กำลังยืม
                            </span>
                          </div>
                        </div>

                        {/* Return Button */}
                        <button
                          onClick={() => handleReturn(item)}
                          disabled={isReturning}
                          className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all
                            ${isReturning
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:scale-[1.02]"
                            }
                          `}
                        >
                          {isReturning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              กำลังคืน...
                            </>
                          ) : (
                            <>
                              <PackageCheck className="w-4 h-4" />
                              คืนอุปกรณ์
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Tips */}
        {!searched && (
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-6">
            <h3 className="font-semibold text-orange-900 mb-3">
              💡 วิธีการคืนอุปกรณ์
            </h3>
            <ol className="space-y-2 text-sm text-orange-800">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </span>
                <span>กรอกเลขบัตรประชาชนของผู้ที่ต้องการคืนอุปกรณ์</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </span>
                <span>ระบบจะแสดงรายการอุปกรณ์ที่ยืมอยู่</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  3
                </span>
                <span>กดปุ่ม "คืนอุปกรณ์" เพื่อทำการคืน</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
