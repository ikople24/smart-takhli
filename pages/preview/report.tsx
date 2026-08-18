// pages/preview/report.tsx
// Wizard แจ้งทุกข์-แจ้งเหตุ 3 ขั้น + จอสำเร็จ (เฟส 2 ของรีดีไซน์ฝั่งประชาชน)
// spec: docs/superpowers/specs/2026-08-18-citizen-report-wizard-design.md
// เข้าด้วย ?category=<Prob_name> = เริ่มขั้น 2 (หมวดตั้งให้แล้ว ย้อนไปขั้น 1 ได้)
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CitizenShell from "@/components/citizen/CitizenShell";
import WizardHeader from "@/components/citizen/report/WizardHeader";
import WizardFooter from "@/components/citizen/report/WizardFooter";
import { SERVICE_LABELS } from "@/components/citizen/home/ServiceGrid";
import StepCategory from "@/components/citizen/report/StepCategory";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";

type Step = 1 | 2 | 3 | "success";

const STEP_META: Record<1 | 2 | 3, { title: string; hint: string }> = {
  1: { title: "แจ้งเรื่องร้องเรียน", hint: "เลือกหมวดหมู่" },
  2: { title: "รายละเอียดปัญหา", hint: "" }, // hint = ชื่อหมวดที่เลือก
  3: { title: "ข้อมูลผู้แจ้ง", hint: "ตรวจสอบและส่ง" },
};

export default function ReportWizard() {
  const router = useRouter();
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();

  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState("");
  const [community, setCommunity] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [prefix, setPrefix] = useState("นาย");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [detail, setDetail] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [complaintId, setComplaintId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetched(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetched]);

  useEffect(() => {
    fetchProblemOptions();
  }, [fetchProblemOptions]);

  // ?category=<Prob_name> จากการ์ดหมวดบนหน้าแรก → ตั้งหมวดแล้วข้ามไปขั้น 2
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.category;
    if (typeof q === "string" && q && !SERVICE_LABELS.includes(q)) {
      setCategory(q);
      setStep(2);
    }
  }, [router.isReady, router.query.category]);

  const complaintMenu = menu.filter((m) => !SERVICE_LABELS.includes(m.Prob_name));

  const goBack = () => {
    setErrors({});
    setSubmitError("");
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const meta = step === "success" ? null : STEP_META[step];

  return (
    <>
      <Head>
        <title>แจ้งทุกข์-แจ้งเหตุ · Smart Takhli</title>
      </Head>
      <CitizenShell hideNav>
        {meta && (
          <WizardHeader
            step={step as 1 | 2 | 3}
            title={meta.title}
            hint={step === 2 ? category : meta.hint}
            onBack={goBack}
          />
        )}

        {step === 1 && (
          <>
            <StepCategory
              menu={complaintMenu}
              loading={menuLoading}
              problemOptions={problemOptions}
              value={category}
              onChange={(label) => {
                setCategory(label);
                setSelectedProblems([]); // ปัญหาที่เลือกไว้เป็นของหมวดเดิม
                setErrors({});
              }}
            />
            <WizardFooter onNext={() => setStep(2)} disabled={!category} />
          </>
        )}
        {step === 2 && (
          <>
            <div className="flex-1 px-4 pb-4 text-sm text-[#9590A8]">(ขั้นรายละเอียด — Task 5)</div>
            <WizardFooter onBack={goBack} onNext={() => setStep(3)} />
          </>
        )}
        {step === 3 && (
          <>
            <div className="flex-1 px-4 pb-4 text-sm text-[#9590A8]">(ขั้นผู้แจ้ง — Task 6)</div>
            <WizardFooter onBack={goBack} onNext={() => {}} nextLabel="ส่งเรื่อง" loading={isSubmitting} />
          </>
        )}
        {step === "success" && (
          <div className="flex-1 px-4 pb-4 text-sm text-[#9590A8]">(จอสำเร็จ — Task 7) {complaintId}</div>
        )}
      </CitizenShell>
    </>
  );
}
