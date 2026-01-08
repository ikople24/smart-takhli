import React from "react";
import { FileText, Clipboard, ArrowRightLeft, Users, GraduationCap } from "lucide-react";

const tabs = [
  {
    key: "request",
    label: "คำขออุปกรณ์",
    icon: FileText,
  },
  {
    key: "elderly-school",
    label: "โรงเรียนผู้สูงอายุ",
    icon: GraduationCap,
  },
  {
    key: "register-device",
    label: "คลังอุปกรณ์",
    icon: Clipboard,
  },
  {
    key: "borrow-return",
    label: "ประวัติการยืม-คืน",
    icon: ArrowRightLeft,
  },
  {
    key: "people",
    label: "ข้อมูลบุคคล",
    icon: Users,
  },
];

export default function DashboardTabs({ selectedTab, onTabChange, counts = {} }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex border-b border-gray-100">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.key;
          const count = counts[tab.key];

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-4 px-3 
                text-sm font-medium transition-all duration-200
                ${isActive
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`
                  px-2 py-0.5 text-xs rounded-full
                  ${isActive ? "bg-primary text-white" : "bg-gray-200 text-gray-600"}
                `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
