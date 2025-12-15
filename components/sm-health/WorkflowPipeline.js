import React from "react";
import {
  CircleDot,
  Stethoscope,
  ClipboardCheck,
  PackageCheck,
  ChevronRight,
} from "lucide-react";

const steps = [
  {
    key: "รับคำร้อง",
    label: "รับคำร้อง",
    shortLabel: "รับคำร้อง",
    icon: CircleDot,
    color: "yellow",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-400",
    textColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
  },
  {
    key: "ประเมินโดยพยาบาลวิชาชีพ",
    label: "ประเมินโดยพยาบาล",
    shortLabel: "ประเมิน",
    icon: Stethoscope,
    color: "blue",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-400",
    textColor: "text-blue-600",
    iconBg: "bg-blue-100",
  },
  {
    key: "ลงทะเบียนอุปกรณ์",
    label: "ลงทะเบียนอุปกรณ์",
    shortLabel: "ลงทะเบียน",
    icon: ClipboardCheck,
    color: "orange",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-400",
    textColor: "text-orange-600",
    iconBg: "bg-orange-100",
  },
  {
    key: "ส่งมอบอุปกรณ์",
    label: "ส่งมอบอุปกรณ์",
    shortLabel: "ส่งมอบ",
    icon: PackageCheck,
    color: "green",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    textColor: "text-green-600",
    iconBg: "bg-green-100",
  },
];

export default function WorkflowPipeline({
  counts = {},
  selectedStatus,
  onStatusClick,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        สถานะคำร้องขออุปกรณ์
      </h2>

      {/* Desktop Pipeline View */}
      <div className="hidden md:flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const count = counts[step.key] || 0;
          const isSelected = selectedStatus === step.key;
          const isActive = count > 0;

          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => onStatusClick(isSelected ? null : step.key)}
                className={`
                  flex-1 relative p-4 rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? `${step.borderColor} ${step.bgColor} shadow-md scale-[1.02]`
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }
                  ${isActive ? "cursor-pointer" : "cursor-default opacity-60"}
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${isSelected ? step.iconBg : "bg-gray-100"}
                  `}
                  >
                    <Icon
                      className={`w-6 h-6 ${isSelected ? step.textColor : "text-gray-500"}`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium text-center ${isSelected ? step.textColor : "text-gray-600"}`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`
                    text-2xl font-bold
                    ${isSelected ? step.textColor : "text-gray-800"}
                  `}
                  >
                    {count}
                  </span>
                  <span className="text-xs text-gray-500">ราย</span>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${step.bgColor} border-b-2 border-r-2 ${step.borderColor}`}
                  ></div>
                )}
              </button>

              {/* Arrow between steps */}
              {index < steps.length - 1 && (
                <ChevronRight className="w-6 h-6 text-gray-300 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile Grid View */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {steps.map((step) => {
          const Icon = step.icon;
          const count = counts[step.key] || 0;
          const isSelected = selectedStatus === step.key;
          const isActive = count > 0;

          return (
            <button
              key={step.key}
              onClick={() => onStatusClick(isSelected ? null : step.key)}
              className={`
                p-4 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? `${step.borderColor} ${step.bgColor} shadow-md`
                  : "border-gray-200 bg-white"
                }
                ${isActive ? "" : "opacity-60"}
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${isSelected ? step.iconBg : "bg-gray-100"}
                `}
                >
                  <Icon
                    className={`w-5 h-5 ${isSelected ? step.textColor : "text-gray-500"}`}
                  />
                </div>
                <div className="text-left">
                  <div
                    className={`text-xs font-medium ${isSelected ? step.textColor : "text-gray-600"}`}
                  >
                    {step.shortLabel}
                  </div>
                  <div
                    className={`text-xl font-bold ${isSelected ? step.textColor : "text-gray-800"}`}
                  >
                    {count} <span className="text-xs font-normal">ราย</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter indicator */}
      {selectedStatus && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            กำลังแสดง: <span className="font-medium">{selectedStatus}</span>
          </span>
          <button
            onClick={() => onStatusClick(null)}
            className="text-sm text-primary hover:underline"
          >
            แสดงทั้งหมด
          </button>
        </div>
      )}
    </div>
  );
}
