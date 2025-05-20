import React, { useEffect, useState } from "react";
import ComplaintCategoryList from "@/components/ComplaintCategoryList";


export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white px-4 pt-6 pb-20">
      <h1 className="text-center text-2xl font-semibold text-gray-800 mb-6">
        SMART-NAMPHRAE
      </h1>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80">
          <span className="loading loading-spinner text-blue-600 w-12 h-12"></span>
        </div>
      )}
      {!loading && <ComplaintCategoryList />}
    </div>
  );
}
