import Head from "next/head";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";

export default function ComplaintListPage() {
  const { fetchComplaints } = useComplaintStore();
  const { menu, fetchMenu } = useMenuStore();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      await fetchComplaints();
      const fetched = await fetch("/api/complaints").then(res => res.json());
      setComplaints(fetched.map(c => ({ ...c, showFull: false })));
      setLoading(false);
    };
    loadData();
    fetchMenu(); // Ensure menu is fetched and available
  }, [fetchComplaints, fetchMenu]);

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
              console.log(item);
              return (
                <div key={item._id} className="card w-full bg-white shadow-md overflow-hidden flex flex-col md:flex-row">
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
                  <p className={`mt-2 text-sm text-gray-600 ${item.showFull ? '' : 'line-clamp-3'}`}>
                    {item.detail}
                    <span className="ml-1 text-gray-400 text-xs">
                      ({new Date(item.updatedAt).toLocaleDateString("th-TH")})
                    </span>
                  </p>
                  {item.detail.length > 100 && (
                    <div className="text-right">
                      <button
                        onClick={() =>
                          setComplaints((prev) =>
                            prev.map((c) =>
                              c._id === item._id ? { ...c, showFull: !c.showFull } : c
                            )
                          )
                        }
                        className="text-xs text-blue-500 mt-1 underline"
                      >
                        {item.showFull ? "แสดงน้อยลง" : "..เพิ่มเติม"}
                      </button>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.problems?.map((prob, i) => (
                      <span key={i} className="badge badge-outline text-xs">
                        {prob}
                      </span>
                    ))}
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
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
