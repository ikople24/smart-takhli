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
import { useMenuStore } from "@/stores/useMenuStore";

export default function PreviewHome() {
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [specialFormData, setSpecialFormData] = useState({ name: "", phone: "", equipment: "", reason: "" });

  useEffect(() => {
    if (!hasFetched && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetched(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetched]);

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
      <CitizenShell onReport={scrollToCategories}>
        <HeaderCard />
        <EnvCards />
        <ComplaintCTA onStart={scrollToCategories} />
        <ServiceGrid menu={menu} loading={menuLoading} onSelect={handleSelect} />
        <NewsSection />
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
