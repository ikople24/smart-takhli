import Head from "next/head";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";

export default function ComplaintListPage() {
  const { complaints, fetchComplaints } = useComplaintStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await fetchComplaints();
      setLoading(false);
    };
    loadData();
  }, [fetchComplaints]);

  return (
    <>
      <Head>
        <title>Smart-Namphare</title>
      </Head>
      <div className="w-full flex justify-center px-4 py-6 min-h-[750px] mx-auto">
        <div className="grid grid-cols-1 gap-4 max-w-screen-xl mx-auto w-full">
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : (
            complaints.map((item) => (
              <div key={item._id} className="card bg-base-100 w-full h-[200px] shadow-sm flex flex-row overflow-hidden">
                <figure className="w-[60%] h-full">
                  <img
                    src={item.images?.[0]}
                    className="w-full h-full object-cover"
                    alt={item.detail}
                  />
                </figure>
                <div className="card-body w-[40%] p-4 relative">
                  <h2 className="card-title text-sm font-bold block w-full pr-16 break-words">
                    {item.problems?.[0] || "ไม่ระบุประเภท"}
                  </h2>
                  <div className="absolute top-2 right-2">
                    <div className="badge badge-secondary whitespace-nowrap text-xs px-2 py-1">
                      {item.community}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">{item.problemOption?.category || "ไม่ระบุหมวดหมู่"}</p>
                  <div className="card-actions justify-end flex-wrap">
                    {item.problemOption?.category ? (
                      <div className="badge badge-outline text-xs">{item.problemOption.category}</div>
                    ) : (
                      <div className="badge badge-outline text-xs">ไม่ระบุหมวดหมู่</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
