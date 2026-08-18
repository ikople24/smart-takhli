// pages/preview.tsx
// หน้าแรกโฉมใหม่ (เฟสทดลอง) — route คู่ขนาน ไม่มีลิงก์เข้าจากที่ไหน
// spec: docs/superpowers/specs/2026-08-18-citizen-home-redesign-design.md
import { useEffect, useState } from "react";
import Head from "next/head";
import CitizenShell from "@/components/citizen/CitizenShell";
import HeaderCard from "@/components/citizen/home/HeaderCard";
import EnvCards from "@/components/citizen/home/EnvCards";
import ComplaintCTA from "@/components/citizen/home/ComplaintCTA";
import ServiceGrid from "@/components/citizen/home/ServiceGrid";
import NewsSection from "@/components/citizen/home/NewsSection";
import ComplaintFormModal from "@/components/complaints/ComplaintFormModal";
import SpecialFormModal from "@/components/sm-health/SpacialFormModal";
import SchoolSurveyModal from "@/components/smart-school/survey/SchoolSurveyModal";
import AvailableListOnly from "@/components/sm-health/AvailableListOnly";
import GarbageHomeCard from "@/components/garbage/GarbageHomeCard";
import StatsRow from "@/components/citizen/home/StatsRow";
import Footer from "@/components/Footer";
import { useMenuStore } from "@/stores/useMenuStore";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import { BookOpen, Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PreviewHome() {
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [specialFormData, setSpecialFormData] = useState({ name: "", phone: "", equipment: "", reason: "" });
  const { menu: healthMenu, loading: healthLoading, fetchMenu: fetchHealthMenu } = useHealthMenuStore();
  const [hasFetchedHealth, setHasFetchedHealth] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // พฤติกรรมหมวดพิเศษเหมือนหน้าแรกเดิม (pages/index.tsx)
  const handleSelect = (label: string) => {
    if (label === "ลงทะเบียนกายอุปกรณ์") setShowSpecialForm(true);
    else if (label === "สำรวจการศึกษา") setShowEducationForm(true);
    else setSelectedLabel(label);
  };

  const scrollToCategories = () => {
    document.getElementById("report-categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Head>
        <title>เทศบาลเมืองตาคลี · Smart Takhli</title>
      </Head>
      <CitizenShell>
        <HeaderCard />
        <EnvCards />

        <section className="mx-4 mt-4">
          <h2 className="text-[15px] font-bold">ตารางรถเก็บขยะ</h2>
          <div className="mt-3">
            <GarbageHomeCard />
          </div>
        </section>

        <ComplaintCTA onStart={scrollToCategories} />
        <ServiceGrid menu={menu} loading={menuLoading} onSelect={handleSelect} />
        <NewsSection />

        <section className="mx-4 mt-6">
          <h2 className="text-[15px] font-bold">ศูนย์กายอุปกรณ์</h2>
          <p className="text-[11px] text-[#9590A8]">ยืม-คืนอุปกรณ์ช่วยเหลือผู้ป่วยและผู้สูงอายุ</p>
          <div className="mt-3">
            <AvailableListOnly menu={healthMenu} loading={healthLoading} />
          </div>
        </section>

        <div className="mx-4 mt-8 flex items-center justify-center gap-4 text-sm text-[#7C3AED]">
          <a href="https://heyzine.com/flip-book/7cf559d572.html" className="flex items-center gap-1 hover:underline">
            <BookOpen size={16} />
            คู่มือประชาชน
          </a>
          {deferredPrompt && (
            <button
              type="button"
              onClick={() => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
              }}
              className="flex items-center gap-1 rounded-full bg-[#7C3AED] px-4 py-2 text-white"
            >
              <Download size={16} />
              ติดตั้งแอป
            </button>
          )}
        </div>

        <StatsRow />

        <Footer />
        <div className="h-8" />
      </CitizenShell>

      {selectedLabel && <ComplaintFormModal selectedLabel={selectedLabel} onClose={() => setSelectedLabel(null)} />}
      {showSpecialForm && (
        <SpecialFormModal formData={specialFormData} setFormData={setSpecialFormData} onClose={() => setShowSpecialForm(false)} />
      )}
      <SchoolSurveyModal isOpen={showEducationForm} onClose={() => setShowEducationForm(false)} />
    </>
  );
}
