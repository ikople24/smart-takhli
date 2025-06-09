import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import CompletedCard from "@/components/CardCompleted";

const StatusPage = () => {
  const { complaints, fetchComplaints } = useComplaintStore();

  useEffect(() => {
    fetchComplaints("ดำเนินการเสร็จสิ้น").then(() => {
      console.log("✅ Complaints (done):", complaints);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4 w-full max-w-4xl mx-auto">
      {complaints.map((item, index) => (
        <CompletedCard
          key={index}
          complaintMongoId={item._id}
          complaintId={item.complaintId}
          title={item.category}
          description={item.detail}
          timestamp={item.createdAt}
          beforeImage={item.images?.[0]}
          afterImage={item.images?.[1]}
          problems={item.problems}
          community={item.community}
          status={item.status}
          location={item.location}
          updatedAt={item.updatedAt}
        />
      ))}
    </div>
  );
};

export default StatusPage;
