import Head from "next/head";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";
import CardModalDetail from "@/components/CardModalDetail";

export default function ComplaintListPage() {
  const { complaints, fetchComplaints } = useComplaintStore();
  const { menu, fetchMenu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState([]);
  const [modalData, setModalData] = useState(null);
  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const loadData = async () => {
      console.log("📤 เรียก API /api/complaints...");
      await fetchComplaints();
      await fetchProblemOptions(); // added
      console.log("✅ ดึง complaints เสร็จ");
      setLoading(false);
    };
    loadData();
    fetchMenu(); // Ensure menu is fetched and available
  }, [fetchComplaints, fetchMenu, fetchProblemOptions]);

  return (
    <>
      <Head>
        <title>Smart-Namphare</title>
      </Head>
      <div className="w-full flex justify-center px-4 py-6 mx-auto">
        <div className="grid grid-cols-1 gap-4 max-w-screen-xl mx-auto w-full">
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : (
            complaints.map((item) => {
              return (
                <div
                  key={item._id}
                  onClick={() => setModalData(item)}
                  className="text-left w-full cursor-pointer"
                >
                  <div className="card w-full bg-white shadow-md overflow-hidden flex flex-col md:flex-row">
                    <figure className="md:w-1/2 w-full h-48 md:h-auto relative overflow-hidden">
                      <Swiper
                        modules={[Autoplay]}
                        autoplay={{ delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                        loop={true}
                        spaceBetween={0}
                        slidesPerView={1}
                        className="w-full h-full"
                      >
                        {item.images?.map((imgUrl, index) => (
                          <SwiperSlide key={index}>
                            <img
                              src={imgUrl}
                              alt={`ภาพที่ ${index + 1}`}
                              className="object-cover w-full h-full"
                            />
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    </figure>
                    <div className="p-4 md:w-1/2 w-full flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold text-gray-800 truncate">
                          {item.problems?.[0] || "ไม่ระบุประเภท"}
                        </h2>
                        <span className="badge badge-secondary text-xs whitespace-nowrap">{item.community}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {expandedIds.includes(item._id) ? item.detail : `${item.detail.slice(0, 100)}...`}
                        <span className="ml-1 text-gray-400 text-xs">
                          ({new Date(item.updatedAt).toLocaleDateString("th-TH")})
                        </span>
                      </p>
                      {item.detail.length > 100 && (
                        <div className="text-right">
                          <button
                            className="text-xs text-blue-500 mt-1 underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item._id);
                            }}
                          >
                            {expandedIds.includes(item._id) ? "ย่อ" : "..เพิ่มเติม"}
                          </button>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.problems?.map((prob, i) => {
                          const found = problemOptions.find((opt) => opt.label === prob);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 border rounded-full text-xs border-gray-300 bg-white/50 backdrop-blur-sm"
                            >
                              {found?.iconUrl && (
                                <img src={found.iconUrl} alt={prob} className="w-4 h-4" />
                              )}
                              <span>{prob}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-auto flex items-center gap-3">
                        {item.category && (
                          <img
                            src={
                              menu.find((m) => m.Prob_name === item.category)?.Prob_pic ||
                              "/default-icon.png"
                            }
                            alt={item.category}
                            className="w-10 h-10 object-contain"
                          />
                        )}
                        <span className="text-lg font-semibold text-gray-800">{item.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <CardModalDetail modalData={modalData} onClose={() => setModalData(null)} />
      </div>
    </>
  );
}
