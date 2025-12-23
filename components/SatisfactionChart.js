import React, { useEffect, useState } from "react";
import { Star, MessageSquare, TrendingUp } from "lucide-react";

const SatisfactionChart = ({ complaintId }) => {
  const [data, setData] = useState([]);
  const [average, setAverage] = useState(0);
  const [averageStars, setAverageStars] = useState(0);

  useEffect(() => {
    const fetchSatisfaction = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/satisfaction/${complaintId}`, {
          method: "GET",
          headers: {
            "x-app-id": process.env.NEXT_PUBLIC_APP_ID || "app_b",
          },
        });
        const result = await res.json();
        if (Array.isArray(result) && result.length > 0) {
          const ratings = result.map((r) => r.rating);
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length || 0;
          setAverage(Math.round(avg * 20));
          setAverageStars(avg);
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching satisfaction data:", error);
      }
    };
    if (complaintId) fetchSatisfaction();
  }, [complaintId]);

  const getStatusText = (avg) => {
    if (avg >= 80) return "พอใจมาก";
    if (avg >= 60) return "พอใจ";
    if (avg >= 40) return "ปานกลาง";
    return "ควรปรับปรุง";
  };

  const getStatusColor = (avg) => {
    if (avg >= 80) return { text: "text-green-600", bg: "bg-green-500", light: "bg-green-100" };
    if (avg >= 60) return { text: "text-blue-600", bg: "bg-blue-500", light: "bg-blue-100" };
    if (avg >= 40) return { text: "text-amber-600", bg: "bg-amber-500", light: "bg-amber-100" };
    return { text: "text-red-600", bg: "bg-red-500", light: "bg-red-100" };
  };

  if (data.length === 0) return null;

  const colors = getStatusColor(average);

  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-4 border border-amber-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center">
          <TrendingUp size={16} className="text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-800">ผลประเมินความพึงพอใจ</h3>
        <span className="ml-auto text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
          {data.length} ครั้ง
        </span>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-center gap-6 py-4">
        {/* Percentage Circle */}
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(${average >= 80 ? '#22c55e' : average >= 60 ? '#3b82f6' : average >= 40 ? '#f59e0b' : '#ef4444'} ${average * 3.6}deg, #e5e7eb ${average * 3.6}deg)`
            }}
          >
            <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${colors.text}`}>{average}%</span>
            </div>
          </div>
        </div>

        {/* Stars & Label */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                className={star <= Math.round(averageStars) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
              />
            ))}
          </div>
          <span className="text-2xl font-bold text-gray-800">
            {averageStars.toFixed(1)}/5
          </span>
          <span className={`text-sm font-medium ${colors.text} mt-1`}>
            {getStatusText(average)}
          </span>
        </div>
      </div>

      {/* Comments */}
      {data.filter((d) => d.comment).length > 0 && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} className="text-amber-600" />
            <h4 className="text-xs font-semibold text-gray-700">ความคิดเห็น</h4>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data
              .filter((d) => d.comment)
              .slice(0, 5)
              .map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={10}
                        className={star <= item.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {item.comment}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SatisfactionChart;
