import React, { useState } from "react";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";

export default function CardAssignment({
  mainImage=["https://res.cloudinary.com/dczmhfvgh/image/upload/v1744043140/Landmark/1744043137037.jpg","https://res.cloudinary.com/dczmhfvgh/image/upload/v1744042887/Landmark/1744042883660.jpg","https://res.cloudinary.com/dczmhfvgh/image/upload/v1742140479/Landmark/1742140475282.jpg"],
  smallImages = ["https://cdn-icons-png.flaticon.com/128/10294/10294639.png","https://cdn-icons-png.flaticon.com/128/10294/10294661.png","https://cdn-icons-png.flaticon.com/128/10294/10294667.png"],
  problemTypes = ["การตัดแต่งกิ่งไม้", "การกำจัดขยะ", "การทำความสะอาดถนน"],
  officerNote = "กองสาธารณสุขและสิ่งแวดล้อมได้ดำเนินการตัดแต่งกิ่งไม้",
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? mainImage.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === mainImage.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-md">
      <div className="flex flex-col justify-between space-y-4">
        {/* วิธีดำเนินการ Section */}
        <div>
          <h2 className="text-md font-semibold mb-4">การดำเนินการ</h2>
          <div className="relative">
            <Image
              src={mainImage[currentIndex]}
              alt={`Main Image ${currentIndex + 1}`}
              width={640}
              height={256}
              className="w-full h-64 object-cover rounded-t-md transition-all duration-500"
            />
            <button
              onClick={handlePrev}
              className="absolute top-1/2 left-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
            >
              ‹
            </button>
            <button
              onClick={handleNext}
              className="absolute top-1/2 right-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
            >
              ›
            </button>
          </div>
        </div>

        {/* เจ้าหน้าที่ Section */}
        <div className="grid grid-cols-5 gap-4 items-start">
          <div className="col-span-3 pr-6 border-r border-gray-300">
            <div className="text-md font-semibold mb-4">วิธีดำเนินการ</div>
            <div className="space-y-3">
              {smallImages.map((image, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Image
                    src={image}
                    alt={`Icon ${index + 1}`}
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                  <span className="text-sm text-gray-800">{problemTypes[index]}</span>
                  <BadgeCheck className="w-5 h-5 text-green-500 ml-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-md font-semibold mb-2">บันทึกเจ้าหน้าที่</div>
            <div className="bg-green-200 border border-green-200 rounded-md p-4 text-green-800 text-sm">
              <p>{officerNote}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
