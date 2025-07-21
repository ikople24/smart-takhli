//pages/complaint/index.jsx
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
import { ChevronDown } from "lucide-react";

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
      await fetchComplaints("อยู่ระหว่างดำเนินการ");
      await fetchProblemOptions();
      console.log("✅ ดึง complaints เสร็จ");
      setLoading(false);
    };
    loadData();
    fetchMenu();
  }, [fetchComplaints, fetchMenu, fetchProblemOptions]);

  return (
    <>
      <Head>
        <title>Smart-Namphare</title>
      </Head>
      <div className="w-full flex justify-center px-4 py-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-screen-xl mx-auto w-full min-h-[300px]">
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : (
            complaints
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((item) => {
                return (
                <div
                  key={item._id}
                  onClick={() => setModalData(item)}
                  className="text-left w-full cursor-pointer"
                >
                  <div className="card w-full bg-white shadow-md overflow-hidden flex flex-col md:flex-row h-[360px] md:h-[340px] relative">
                    <figure className="md:w-1/2 w-full aspect-[4/3] h-auto relative overflow-hidden">
                      <div className="absolute top-2 right-2 z-10">
                        <span className="px-2 py-1 text-info text-xs font-medium rounded-full bg-white/80 backdrop-blur-md shadow-sm">
                          {new Date(item.createdAt).toLocaleDateString("th-TH", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-2 left-2 z-10 flex flex-wrap gap-2">
                        {item.problems?.map((prob, i) => {
                          const found = problemOptions.find(
                            (opt) => opt.label === prob
                          );
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 border rounded-full text-xs border-gray-300 bg-white/80 backdrop-blur-sm shadow"
                            >
                              {found?.iconUrl && (
                                <img
                                  src={found.iconUrl}
                                  alt={prob}
                                  className="w-4 h-4"
                                />
                              )}
                              <span>{prob}</span>
                            </div>
                          );
                        })}
                      </div>
                      {item.images?.length === 1 ? (
                        <img
                          src={item.images[0]}
                          alt="ภาพร้องเรียน"
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <Swiper
                          modules={[Autoplay]}
                          autoplay={{
                            delay: 3000,
                            disableOnInteraction: false,
                            pauseOnMouseEnter: true,
                          }}
                          loop={item.images?.length > 1}
                          spaceBetween={0}
                          slidesPerView={1}
                          className="w-full h-full"
                          style={{ height: "100%" }}
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
                      )}
                    </figure>
                    <div className="p-4 md:w-1/2 w-full flex flex-col gap-2 justify-start">
                      <div className="pr-1">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {item.category && (
                                <img
                                  src={
                                    menu.find((m) => m.Prob_name === item.category)
                                      ?.Prob_pic || "/default-icon.png"
                                  }
                                  alt={item.category}
                                  className="w-10 h-10 object-contain"
                                />
                              )}
                              <div className="text-base md:text-lg font-bold text-gray-900 break-words whitespace-normal">
                                {item.category}
                              </div>
                            </div>
                            <span className="badge badge-secondary text-xs">{item.community}</span>
                          </div>
                        </div>
                        <div className="relative pr-1 mt-2">
                          <p className="text-sm text-gray-600">
                            {expandedIds.includes(item._id)
                              ? item.detail
                              : `${item.detail.slice(0, 200)}...`}
                          </p>
                        </div>
                        {item.detail.length > 100 && (
                          <div className="absolute bottom-2 right-2 z-20">
                            <button
                              className="p-1 bg-white/65 rounded-full shadow"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item._id);
                              }}
                            >
                              <ChevronDown
                                size={16}
                                className={`transition-transform ${
                                  expandedIds.includes(item._id) ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <CardModalDetail
          modalData={modalData}
          onClose={() => setModalData(null)}
        />
      </div>
    </>
  );
}
