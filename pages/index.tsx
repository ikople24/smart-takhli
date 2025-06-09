import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useMenuStore, MenuItem } from "@/stores/useMenuStore";
import ComplaintFormModal from "@/components/ComplaintFormModal";
import Footer from "@/components/Footer";

export default function Home() {
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const texts = useMemo(() => [
    "แจ้งทุกข์ - แจ้งเหตุ",
    "ลงทะเบียน กายอุปกรณ์",
    "เทศบาลเมืองตาคลี",
    "Smart Solution Award 2023",
  ], []);
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];
    if (charIndex < currentText.length) {
      const timeout = setTimeout(() => {
        setDisplayText(currentText.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 75);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCharIndex(0);
        setTextIndex((prev) => (prev + 1) % texts.length);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, textIndex, texts]);

  useEffect(() => {
    if (!hasFetched && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetched(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetched]);


  const handleOpenModal = (label: string) => {
    setSelectedLabel(label);
  };
  const handleCloseModal = () => {
    setSelectedLabel(null);
  };

  useEffect(() => {
    console.log("📦 menu from store:", menu);
  }, [menu]);
  return (
    <div className="min-h-screen bg-white flex flex-col -mt-8 w-full max-w-screen-sm min-w-[320px] mx-auto overflow-x-hidden">
      {/* <h1 className="fixed top-0 left-0 right-0 z-50 bg-white/30 backdrop-blur-md border border-white/40 text-center text-2xl font-semibold text-blue-950 text-shadow-gray-800 shadow-lg py-4">
        SMART-NAMPHRAE
      </h1> */}
      <div className="mt-8 text-center text-xl font-semibold min-h-[1.5rem]">
        <span className={
          textIndex === 0 ? "text-pink-600" :
            textIndex === 1 ? "text-emerald-600" :
              "text-indigo-600"
        }>
          {displayText}
        </span>
        <span className="animate-pulse text-indigo-500">|</span>
      </div>
      <div className="flex-1 px-4 pt-8 pb-20 w-full max-w-screen-sm mx-auto">
        {menuLoading ? (
          <div className="flex justify-center items-center h-60">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {menu.map((item: MenuItem, index) => (
                <button
                  key={item._id || index}
                  className="flex flex-col items-center rounded-xl"
                  onClick={() => handleOpenModal(item.Prob_name)}
                >
                  <div className="w-40 h-40 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-2 transform transition duration-200 hover:scale-105 relative">
                    <Image
                      src={item.Prob_pic}
                      alt={item.Prob_name}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center text-gray-700 text-sm sm:text-md font-medium">
                    {item.Prob_name}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        {selectedLabel && (
          <ComplaintFormModal selectedLabel={selectedLabel} onClose={handleCloseModal} />
        )}
      </div>
      <Footer />
    </div>
  );
}
