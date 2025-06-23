import CardModalDetail from "@/components/CardModalDetail";
import Head from "next/head";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import CompletedCard from "@/components/CardCompleted";


const StatusPage = () => {
  const { complaints, fetchComplaints } = useComplaintStore();
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    fetchComplaints("ดำเนินการเสร็จสิ้น").then(() => {
      console.log("✅ Complaints (done):", complaints);
    });
  }, []);

  const normalizeDate = (dateStr) => {
    const d = new Date(dateStr);
    if (d.getFullYear() > 2500) {
      d.setFullYear(d.getFullYear() - 543);
    }
    return d;
  };

  // Sort complaints by completedAt or updatedAt (latest first)
  const paginatedComplaints = [...complaints]
    .sort((a, b) => normalizeDate(b.completedAt || b.updatedAt) - normalizeDate(a.completedAt || a.updatedAt))
    .slice(0, 10);

  return (
    <>
      <Head>
        <title>ดำเนินการเสร็จสิ้น</title>
      </Head>
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
      <CardModalDetail
        modalData={modalData}
        onClose={() => setModalData(null)}
      />
    </>
  );
};

export default StatusPage;
