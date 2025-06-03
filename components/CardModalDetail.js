import { Dialog } from "@headlessui/react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { useEffect, useState } from "react";

export default function CardModalDetail({ modalData, onClose }) {
  const { menu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  const [categoryIcon, setCategoryIcon] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    fetchProblemOptions();
  }, []);

  useEffect(() => {
    if (modalData?.category && menu?.length) {
      const matched = menu.find((m) => m.Prob_name === modalData.category);
      if (matched) {
        setCategoryIcon(matched.Prob_pic);
      }
    }
  }, [modalData, menu]);

  useEffect(() => {
    setPreviewImg(null); // Clear preview image on modalData change
    setCurrentSlide(0);  // Reset slide index
  }, [modalData]);

  if (!modalData) return null;

  return (
    <>
      <Dialog
        as="div"
        open={!!modalData}
        onClose={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/10"
      >
        <Dialog.Panel className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
          {modalData.images?.[0] && (
            <div className="relative w-full h-48 rounded-b-xl overflow-hidden">
              <div className="carousel w-full h-full">
                {modalData.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`carousel-item relative w-full h-48 ${currentSlide === idx ? 'block' : 'hidden'}`}
                  >
                    <div className="relative w-full h-full">
                      <img
                        src={img}
                        alt={`slide-${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        className="absolute bottom-2 right-2 z-20 bg-white/20 hover:bg-white/40 border-white/30 text-white text-xl p-1 rounded-full backdrop-blur"
                        title="ดูรูปเต็มจอ"
                        onClick={() => setPreviewImg(img)}
                      >
                        🔍
                      </button>
                    </div>
                    <div className="absolute flex justify-between transform -translate-y-1/2 left-2 right-2 top-1/2 z-10">
                      <button
                        onClick={() =>
                          setCurrentSlide((currentSlide - 1 + modalData.images.length) % modalData.images.length)
                        }
                        className="btn btn-circle btn-sm bg-white/20 hover:bg-white/40 border-white/30 text-white backdrop-blur"
                      >
                        ❮
                      </button>
                      <button
                        onClick={() =>
                          setCurrentSlide((currentSlide + 1) % modalData.images.length)
                        }
                        className="btn btn-circle btn-sm bg-white/20 hover:bg-white/40 border-white/30 text-white backdrop-blur"
                      >
                        ❯
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 z-10 flex flex-col items-start bg-black/50 backdrop-blur-none p-2 rounded-lg gap-1 w-full">
                <div className="flex flex-col items-start w-full gap-1">
                  <div className="flex items-center w-full gap-3">
                    {categoryIcon && (
                      <img
                        src={categoryIcon}
                        alt="category icon"
                        className="w-13 h-13 object-contain"
                      />
                    )}
                    <div>
                      <span className="text-white text-lg font-semibold flex items-center gap-1">
                        <span className="text-yellow-300">📍</span> {modalData.community}
                      </span>
                      <div className="flex items-center gap-2 text-white text-xs mt-1">
                        <span>
                          {new Date(
                            modalData.createdAt || modalData.updatedAt
                          ).toLocaleDateString("th-TH", {
                            year: "2-digit",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {modalData.status && (
                          <span className="border border-yellow-400 text-yellow-400 font-semibold px-3 py-1 rounded-full text-xs bg-yellow-400/10">
                            ● {modalData.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="p-4">
            <div className="mb-3">
              <div className="font-semibold mb-1">ปัญหาที่พบ</div>
              <div className="flex flex-wrap gap-2">
                {modalData.problems?.map((p, idx) => {
                  const matched = problemOptions.find((opt) => opt.label === p);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1 border border-gray-300 px-3 py-1 rounded-full shadow-sm bg-white text-sm text-gray-800"
                    >
                      {matched?.iconUrl && (
                        <img
                          src={matched.iconUrl}
                          alt={p}
                          className="w-4 h-4 object-contain"
                        />
                      )}
                      <span>{p}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1">รายละเอียด</div>
              <div className="bg-yellow-50 p-3 text-sm text-gray-700 rounded border">
                {modalData.detail}
              </div>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setPreviewImg(null);
                  setCurrentSlide(0);
                  onClose();
                }}
                className="btn btn-sm btn-outline"
              >
                ปิด
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>

      {previewImg && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImg}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-lg"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImg(null);
              }}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-black rounded-full px-2 py-1 text-sm shadow"
            >
              ✖
            </button>
          </div>
        </div>
      )}
    </>
  );
}