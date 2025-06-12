//page/status/index.jsx
import CardModalDetail from "@/components/CardModalDetail";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import CompletedCard from "@/components/CardCompleted";


const StatusPage = () => {
  const { complaints, fetchComplaints } = useComplaintStore();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    fetchComplaints("ดำเนินการเสร็จสิ้น").then(() => {
      console.log("✅ Complaints (done):", complaints);
    });
  }, []);

  const paginatedComplaints = [...complaints]
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4 w-full max-w-4xl mx-auto min-h-screen items-stretch">
        {paginatedComplaints.map((item, index) => (
          <div key={index} className="h-full">
            <div onClick={() => setModalData(item)} className="cursor-pointer h-full flex flex-col">
              <div className="flex-1">
                <CompletedCard
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
                  updatedAt={item.completedAt}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="join flex justify-center mt-4">
        <button
          className="join-item btn btn-xs"
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        >
          «
        </button>
        <button className="join-item btn btn-xs">หน้า {currentPage}</button>
        <button
          className="join-item btn btn-xs"
          onClick={() =>
            setCurrentPage((p) =>
              p < Math.ceil(complaints.length / itemsPerPage) ? p + 1 : p
            )
          }
        >
          »
        </button>
      </div>
      <CardModalDetail
        modalData={modalData}
        onClose={() => setModalData(null)}
      />
    </>
  );
};

export default StatusPage;
