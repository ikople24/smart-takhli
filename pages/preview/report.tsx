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
import { SERVICE_LABELS } from "@/lib/citizen/serviceLabels";
import StepCategory from "@/components/citizen/report/StepCategory";
import StepDetails from "@/components/citizen/report/StepDetails";
import StepReporter from "@/components/citizen/report/StepReporter";
import StepSuccess from "@/components/citizen/report/StepSuccess";
import { fullReportSchema, stepDetailsSchema, stepReporterSchema, validateStep } from "@/lib/citizen/report/schema";
import { buildComplaintPayload } from "@/lib/citizen/report/payload";
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

  const handleSubmit = async () => {
    // กันกดซ้ำ + กันส่งระหว่างรูปกำลังอัปโหลด (พฤติกรรมเดิมของฟอร์ม)
    if (isSubmitting || isUploading) return;
    const trimmed = { prefix, fullName: fullName.trim(), phone, detail: detail.trim(), location };
    const stepErrs = validateStep(stepReporterSchema, trimmed);
    setErrors(stepErrs);
    if (Object.keys(stepErrs).length > 0) return;
    // ตรวจรวมทั้งก้อนก่อนส่งจริง (เผื่อย้อนไปแก้จนขั้นก่อนหน้าไม่ครบ)
    const fullErrs = validateStep(fullReportSchema, {
      category,
      community,
      selectedProblems,
      imageUrls,
      ...trimmed,
    });
    if (Object.keys(fullErrs).length > 0) {
      setErrors(fullErrs);
      setSubmitError("ข้อมูลบางขั้นยังไม่ครบ กรุณาย้อนกลับตรวจสอบ");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const payload = buildComplaintPayload(
        { prefix, fullName, phone, community, selectedProblems, category, imageUrls, detail, location },
        problemOptions
      );
      const res = await fetch("/api/submittedreports/submit-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-id": process.env.NEXT_PUBLIC_APP_ID || "app_b",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("ส่งข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setComplaintId(data.complaintId);
      setStep("success");
      window.scrollTo(0, 0);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <StepDetails
              category={category}
              community={community}
              onCommunity={setCommunity}
              problemOptions={problemOptions}
              selectedProblems={selectedProblems}
              onToggleProblem={(id) =>
                setSelectedProblems((prev) =>
                  prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
                )
              }
              onImages={setImageUrls}
              onUploading={setIsUploading}
              errors={errors}
            />
            <WizardFooter
              onBack={goBack}
              onNext={() => {
                const errs = validateStep(stepDetailsSchema, { community, selectedProblems, imageUrls });
                setErrors(errs);
                if (Object.keys(errs).length === 0) setStep(3);
              }}
            />
          </>
        )}
        {step === 3 && (
          <>
            <StepReporter
              prefix={prefix}
              setPrefix={setPrefix}
              fullName={fullName}
              setFullName={setFullName}
              phone={phone}
              setPhone={setPhone}
              detail={detail}
              setDetail={setDetail}
              location={location}
              setLocation={setLocation}
              useCurrentLocation={useCurrentLocation}
              setUseCurrentLocation={setUseCurrentLocation}
              errors={errors}
            />
            {submitError && (
              <p className="px-4 pb-2 text-[12px] font-medium text-[#DC2626]">{submitError}</p>
            )}
            <WizardFooter onBack={goBack} onNext={handleSubmit} nextLabel="ส่งเรื่อง" loading={isSubmitting} />
          </>
        )}
        {step === "success" && <StepSuccess complaintId={complaintId} />}
      </CitizenShell>
    </>
  );
}
