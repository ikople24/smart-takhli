
import React, { useEffect } from "react";

const SatisfactionChart = ({ complaintId }) => {

  useEffect(() => {
    async function fetchSatisfaction() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/satisfaction/${complaintId}`, {
        method: "GET",
        headers: {
          "x-app-id": process.env.NEXT_PUBLIC_APP_ID || "app_a",
        },
      });
      await res.json();
    }

    if (complaintId) {
      fetchSatisfaction();
    }
  }, [complaintId]);

  return (
    <div>
      {/* Render chart or feedbacks */}
    </div>
  );
};

export default SatisfactionChart;
