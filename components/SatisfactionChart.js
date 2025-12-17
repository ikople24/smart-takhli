import React, { useEffect, useState } from "react";

const SatisfactionChart = ({ complaintId }) => {
  // console.log("📊 Rendering SatisfactionChart for complaintId:", compleintId);
  const [data, setData] = useState([]);
  const [average, setAverage] = useState(0);

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
        const ratings = result.map((r) => r.rating);
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length || 0;
        setAverage(Math.round(avg * 20));
        setData(result);
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

  if (data.length === 0) return null;
  return (
    <div className="bg-white rounded-lg shadow p-4 w-full max-w-md mx-auto">
      <h2 className="text-center font-bold text-lg mb-4">ระดับความพึงพอใจ</h2>
      <div className="flex justify-center">
        <div
          className={`radial-progress after:content-none ${
            average >= 80 ? 'text-green-500' : average >= 60 ? 'text-orange-500' : 'text-red-500'
          }`}
          style={{
            "--value": average,
            "--thickness": "10px",
            "--size": "8rem",
            "--track-color": "transparent",
            "--start-angle": "0deg",
            "--end-angle": "360deg",
            fontSize: "2rem",
            width: "7rem",
            height: "7rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            backgroundColor: "white", // background to avoid merging text and border
            borderRadius: "9999px",   // fully round shape
            position: "relative",
            zIndex: 10,
          }}
          role="progressbar"
        >
          {average}%
        </div>
      </div>
      
      <p className="text-center text-sm text-gray-500">
        {getStatusText(average)}
      </p>

      <div className="mt-6">
        <h3 className="font-medium">ความคิดเห็นอื่นๆ</h3>
        <div className="space-y-2 mt-2">
          {data
            .filter((d) => d.comment)
            .slice(0, 5)
            .map((item, idx) => (
              <div
                key={idx}
                className={`rounded px-3 py-2 text-sm ${
                  idx % 2 === 0
                    ? "bg-violet-50"
                    : "bg-green-50 text-gray-800 font-medium"
                }`}
              >
                {item.comment}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SatisfactionChart;
