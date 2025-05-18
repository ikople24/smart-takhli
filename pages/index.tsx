import React from "react";
import ComplaintCategoryList from "@/components/ComplaintCategoryList";


export default function Home() {
  return (
    <div className="min-h-screen bg-white px-4 pt-6 pb-20">
      <h1 className="text-center text-xl font-bold text-gray-800 mb-6">
        เลือกประเภทเรื่องร้องเรียน
      </h1>
      <ComplaintCategoryList />
    </div>
  );
}
