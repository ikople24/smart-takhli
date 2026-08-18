// pages/preview.tsx
// หน้าแรกโฉมใหม่ (เฟสทดลอง) — route คู่ขนาน ไม่มีลิงก์เข้าจากที่ไหน
// spec: docs/superpowers/specs/2026-08-18-citizen-home-redesign-design.md
import Head from "next/head";
import CitizenShell from "@/components/citizen/CitizenShell";
import HeaderCard from "@/components/citizen/home/HeaderCard";
import EnvCards from "@/components/citizen/home/EnvCards";

export default function PreviewHome() {
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
      </CitizenShell>
    </>
  );
}
