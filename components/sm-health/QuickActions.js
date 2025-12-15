import React from "react";
import { ArrowRight, ArrowLeft, FileText, Users, Settings } from "lucide-react";

export default function QuickActions({ onBorrow, onReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        ดำเนินการด่วน
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Borrow Button */}
        <button
          onClick={onBorrow}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowRight className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">ยืมอุปกรณ์</span>
        </button>

        {/* Return Button */}
        <button
          onClick={onReturn}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">คืนอุปกรณ์</span>
        </button>

        {/* View Report */}
        <button
          onClick={() => window.location.href = '/admin/smart-health-delivery'}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">รายงานส่งมอบ</span>
        </button>

        {/* Manage Users */}
        <button
          onClick={() => {}}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">จัดการผู้ใช้</span>
        </button>
      </div>
    </div>
  );
}
