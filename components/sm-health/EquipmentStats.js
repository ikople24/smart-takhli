import React from "react";
import Image from "next/image";
import { Package, CheckCircle } from "lucide-react";

export default function EquipmentStats({ menu = [], loading = false }) {
  const totalAvailable = menu.reduce(
    (sum, item) => sum + (item.available || 0),
    0
  );
  const totalItems = menu.length;
  const availableTypes = menu.filter((item) => item.available > 0).length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-3 h-24"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          อุปกรณ์พร้อมใช้งาน
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:inline">พร้อมยืม</span> {totalAvailable}
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            {availableTypes}/{totalItems} ประเภท
          </span>
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {menu.map((item, index) => {
          const isAvailable = item.available > 0;
          return (
            <div
              key={index}
              className={`
                relative rounded-xl p-3 transition-all duration-200
                ${isAvailable
                  ? "bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 hover:shadow-md hover:scale-[1.02]"
                  : "bg-gray-50 border border-gray-200 opacity-60"
                }
              `}
            >
              {/* Status Badge */}
              <div
                className={`
                absolute top-2 right-2 w-2 h-2 rounded-full
                ${isAvailable ? "bg-green-500" : "bg-gray-400"}
              `}
              ></div>

              {/* Icon */}
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 relative">
                  <Image
                    src={item.image_icon || "/default-icon.png"}
                    alt={item.label}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-700 truncate">
                  {item.label}
                </div>
                <div
                  className={`text-lg font-bold mt-1 ${isAvailable ? "text-green-600" : "text-gray-400"}`}
                >
                  {item.available || 0}
                </div>
                <div className="text-[10px] text-gray-500">รายการ</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {menu.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>ไม่พบข้อมูลอุปกรณ์</p>
        </div>
      )}
    </div>
  );
}
