type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useMenuStore, MenuItem } from "@/stores/useMenuStore";
import ComplaintFormModal from "@/components/complaints/ComplaintFormModal";
import Pm25Dashboard from "@/components/Pmdata";
import WaterQualityCard from "@/components/smart-papar/WaterQualityCard";
import Footer from "@/components/Footer";

import SpecialFormModal from "@/components/sm-health/SpacialFormModal";
import AvailableListOnly from "@/components/sm-health/AvailableListOnly";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import { BookOpen, Download } from "lucide-react";

import SchoolSurveyModal from "@/components/smart-school/survey/SchoolSurveyModal";
import ActivityFeed from "@/components/activities/ActivityFeed";
import SiteStatsBar from "@/components/site-stats/SiteStatsBar";

export default function Home() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const { menu: healthMenu, loading: healthLoading, fetchMenu: fetchHealthMenu } = useHealthMenuStore();
  const [formData, setFormData] = useState({ name: "", phone: "", equipment: "", reason: "" });
  const [hasFetchedHealth, setHasFetchedHealth] = useState(false);


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

  useEffect(() => {
    if (!hasFetchedHealth && healthMenu.length === 0 && !healthLoading) {
      fetchHealthMenu();
      setHasFetchedHealth(true);
    }
  }, [healthMenu.length, fetchHealthMenu, healthLoading, hasFetchedHealth]);


  const handleOpenModal = (label: string) => {
    if (label === "ลงทะเบียนกายอุปกรณ์") {
      setShowSpecialForm(true);
    } else if (label === "สำรวจการศึกษา") {
      setShowEducationForm(true);
    } else {
      setSelectedLabel(label);
    }
  };
  const handleCloseModal = () => {
    setSelectedLabel(null);
  };

  useEffect(() => {
    console.log("📦 menu from store:", menu);
  }, [menu]);
  return (
    <div className="min-h-screen bg-white flex flex-col -mt-8 w-full max-w-screen-sm min-w-[320px] mx-auto overflow-x-hidden">
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
      <div className="mt-4 px-4 w-full max-w-screen-sm mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
          <Pm25Dashboard className="sm:w-[60%] h-full" />
          <WaterQualityCard className="sm:w-[40%] h-full" />
        </div>
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
            {/* {section 2 smart-health} */}
            <div className="flex flex-col items-center mt-4 mb-2 p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-grid *:[grid-area:1/1]">
                  <div className="status status-success status-lg animate-ping"></div>
                  <div className="status status-success status-lg"></div>
                </div>
                <span className="font-bold text-blue-400">SMART-HEALTH</span>
              </div>
              <span className="font-semibold text-blue-400">✨ ศูนย์กายอุปกรณ์ ✨</span>
              <AvailableListOnly menu={healthMenu} loading={healthLoading} />
            </div>

            {/* ข่าวกิจกรรม */}
            <div className="flex flex-col items-center mt-4 mb-2 p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-grid *:[grid-area:1/1]">
                  <div className="status status-info status-lg animate-ping"></div>
                  <div className="status status-info status-lg"></div>
                </div>
                <span className="font-bold text-indigo-400">ACTIVITY NEWS</span>
              </div>
              <ActivityFeed limit={3} showViewAll />
            </div>
          </>
        )}
        {selectedLabel && (
          <ComplaintFormModal selectedLabel={selectedLabel} onClose={handleCloseModal} />
        )}
      </div>
      {showSpecialForm && (
        <SpecialFormModal
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowSpecialForm(false)}
        />
      )}

      <SchoolSurveyModal
        isOpen={showEducationForm}
        onClose={() => setShowEducationForm(false)}
      />

      <div className="flex justify-center items-center gap-4 text-purple-400 text-sm mb-4">
        <a
          href="https://heyzine.com/flip-book/7cf559d572.html"
          className="flex items-center gap-1 hover:underline"
        >
          <BookOpen size={16} className="text-purple-500" />
          คู่มือประชาชน
        </a>
        {deferredPrompt && (
          <button
            onClick={() => {
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then(() => {
                setDeferredPrompt(null);
              });
            }}
            className="flex items-center gap-1 mt-1 bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
          >
            <Download size={16} className="text-white" />
            ติดตั้งแอป
          </button>
        )}
      </div>

      <SiteStatsBar />

      <Footer />
    </div>
  );
}
