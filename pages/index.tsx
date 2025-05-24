import React, { useEffect, useState } from "react";
import { useMenuStore, MenuItem } from "@/stores/useMenuStore";
import ComplaintFormModal from "@/components/ComplaintFormModal";

export default function Home() {
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (menu.length === 0 && !menuLoading) fetchMenu();
  }, [menu.length, fetchMenu, menuLoading]);


  const handleOpenModal = (label: string) => {
    setSelectedLabel(label);
  };
  const handleCloseModal = () => {
    setSelectedLabel(null);
  };

  console.log("📦 menu from store:", menu);
  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <h1 className="fixed top-0 left-0 right-0 z-50 bg-white/30 backdrop-blur-md border border-white/40 text-center text-2xl font-semibold text-blue-950 text-shadow-gray-800 shadow-lg py-4">
        SMART-NAMPHRAE
      </h1>
      <div className="px-4 pt-24 pb-20 w-full max-w-4xl">
        {menuLoading ? (
          <div className="flex justify-center items-center h-60">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {menu.map((item: MenuItem, index) => (
              <button
                key={item._id || index}
                className="flex flex-col items-center rounded-xl"
                onClick={() => handleOpenModal(item.Prob_name)}
              >
                <div className="w-55 h-55 rounded-full overflow-hidden mb-2 transform transition duration-200 hover:scale-105 relative">
                  <img
                    src={item.Prob_pic}
                    alt={item.Prob_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center text-gray-700 text-md font-medium">
                  {item.Prob_name}
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedLabel && (
          <ComplaintFormModal selectedLabel={selectedLabel} onClose={handleCloseModal} />
        )}
      </div>
    </div>
  );
}
