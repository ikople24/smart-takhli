import React from "react";
import Image from "next/image";

export default function DemographicSummaryCards() {
  const data = [
    {
      label: "ผู้สูงอายุ",
      count: "4,902 ราย",
      color: "indigo-500",
      icon: "https://cdn-icons-png.flaticon.com/512/8363/8363104.png",
    },
    {
      label: "ผู้พิการ",
      count: "692 ราย",
      color: "yellow-600",
      icon: "https://cdn-icons-png.flaticon.com/512/7168/7168841.png",
    },
    {
      label: "ต้องการความช่วยเหลือ",
      count: "275 ราย",
      color: "pink-500",
      icon: "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/OaDmnKuwRMlnonvB6UqD/pub/QhYraHVt1Mqmk8MgN2Xp.png",
    },
    {
      label: "แพมเพิสผู้ใหญ่",
      count: "90 ราย",
      color: "fuchsia-700",
      icon: "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/OaDmnKuwRMlnonvB6UqD/pub/BH1jjwmoZq4LX3AvTxg6.png",
    },
    {
      label: "กายอุปกรณ์",
      count: "34 ราย",
      color: "slate-700",
      icon: "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/OaDmnKuwRMlnonvB6UqD/pub/N48duzAKxxbdegt613QU.png",
    },
    {
      label: "ผู้มีภาวะพึ่งพิง",
      count: "25 ราย",
      color: "rose-700",
      icon: "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/OaDmnKuwRMlnonvB6UqD/pub/lsbg0ecMf1fCcgG9QJGC.png",
    },
  ];

  return (
    <>
    <h1 className="text-xl font-bold text-center mb-4">สรุปข้อมูลประชากร</h1>
    <p className="text-sm text-gray-600 text-center mb-6">
      ข้อมูลสรุปประชากรที่ต้องการความช่วยเหลือในเขตเทศบาลเมืองตาคลี
    </p>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-4 justify-center max-w-screen-xl mx-auto px-4 mt-6">
        {data.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl px-4 py-5 text-center shadow-sm w-full sm:w-[160px] flex flex-col items-center justify-between gap-2 min-h-[140px]"
          >
            <Image
              src={item.icon}
              alt={item.label}
              width={56}
              height={56}
              className={`object-contain text-${item.color}`}
            />
            <span className="text-sm font-medium text-gray-700 min-h-[24px] flex items-center">
              {item.label}
            </span>
            <div className={`text-2xl items-end font-bold text-${item.color}`}>
              {item.count}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
