import type { FC } from "react";
import Image from "next/image";
import type { MenuObHealth } from "@/stores/useHealthMenuStore";

interface AvailableListOnlyProps {
  menu?: MenuObHealth[];
  loading?: boolean;
}

const AvailableListOnly: FC<AvailableListOnlyProps> = ({ menu = [], loading = false }) => (
  <div className="w-full">
    <div className="
      overflow-x-auto
      flex-nowrap
      flex
      gap-2
      justify-center
      pb-2
      sm:overflow-x-visible
      sm:flex-wrap
      sm:gap-5
    ">
      {loading
        ? Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl shadow-md p-2 w-[75px] min-h-[110px] flex flex-col items-center animate-pulse
              sm:w-[140px] sm:p-4 sm:min-h-[170px]"
          >
            <div className="skeleton h-7 w-7 mb-1 rounded-full bg-gray-300 sm:h-16 sm:w-16"></div>
            <div className="skeleton h-2 w-8 mb-1 rounded bg-gray-200 sm:h-3 sm:w-20"></div>
            <div className="skeleton h-1.5 w-5 mb-1 rounded bg-gray-100 sm:h-2 sm:w-10"></div>
            <div className="skeleton h-1.5 w-7 rounded bg-gray-100 mt-auto sm:h-3 sm:w-16"></div>
          </div>
        ))
        : menu.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-md p-2 w-[75px] min-h-[110px] flex flex-col items-center
              sm:w-[140px] sm:p-4 sm:min-h-[170px]"
          >
            <div className="w-7 h-7 relative mb-1 sm:w-16 sm:h-16">
              <Image
                src={item.image_icon || "/default-icon.png"}
                alt={item.label}
                width={64}
                height={64}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="text-center font-semibold text-xs sm:text-base">{item.label}</div>
            <div className="flex flex-col items-center mt-auto">
              <div className="text-green-600 text-xs sm:text-sm">✅พร้อมยืม</div>
              <div className="text-[10px] text-gray-500 sm:text-sm">
                {typeof item.available === "number" ? item.available : 0} รายการ
              </div>
            </div>
          </div>
        ))}
    </div>
  </div>
);

export default AvailableListOnly;