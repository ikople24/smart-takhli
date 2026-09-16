// pages/report.tsx
// Wizard แจ้งทุกข์-แจ้งเหตุ: จอข้อตกลง (ด่านแรก) → 3 ขั้น → จอสำเร็จ (เฟส 2 ของรีดีไซน์ฝั่งประชาชน)
// spec: docs/superpowers/specs/2026-08-18-citizen-report-wizard-design.md
// เข้าด้วย ?category=<Prob_name> = เลือกหมวดให้ล่วงหน้าเท่านั้น ยังต้องผ่านด่านข้อตกลงก่อน
// (ยอมรับแล้วจึงไปขั้น 2 พร้อมหมวดที่ตั้งไว้ ย้อนไปขั้น 1 ได้)
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
import ConsentScreen from "@/components/citizen/report/ConsentScreen";
import { shouldShowConsent } from "@/lib/citizen/report/consent";
import { readConsent, writeConsent } from "@/lib/citizen/report/consentStorage";
import { fullReportSchema, stepDetailsSchema, stepReporterSchema, validateStep } from "@/lib/citizen/report/schema";
import { buildComplaintPayload } from "@/lib/citizen/report/payload";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";

// "checking" = กำลังอ่านค่ายินยอมจากเครื่อง ยังไม่วาดอะไร (localStorage อ่านฝั่งเซิร์ฟเวอร์ไม่ได้
// ถ้าเริ่มที่ "consent" คนที่เคยยอมรับแล้วจะเห็นจอข้อตกลงกระพริบ 1 เฟรมทุกครั้ง)
type Step = "checking" | "consent" | 1 | 2 | 3 | "success";

const STEP_META: Record<1 | 2 | 3, { title: string; hint: string }> = {
  1: { title: "แจ้งเรื่องร้องเรียน", hint: "เลือกหมวดหมู่" },
  2: { title: "รายละเอียดปัญหา", hint: "" }, // hint = ชื่อหมวดที่เลือก
  3: { title: "ข้อมูลผู้แจ้ง", hint: "ตรวจสอบและส่ง" },
};

export default function ReportWizard() {
  const router = useRouter();
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();

  const [step, setStep] = useState<Step>("checking");
  const [consent, setConsent] = useState<{ version: string; acceptedAt: string } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
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

  // สอง effect ด้านล่างทำงานคู่กัน และพึ่งพาว่า setConsent/setConsentChecked ลงในเรนเดอร์เดียวกัน
  // ถ้าวันหลังเปลี่ยนการอ่านค่ายินยอมเป็นแบบ async (เช่น ย้ายไป IndexedDB/เรียก API) ด่านจะเห็น
  // consentChecked=true ทั้งที่ consent ยังว่าง แล้วดันคนที่เคยยอมรับแล้วไปค้างที่จอข้อตกลง
  // อ่านค่ายินยอมจากเครื่อง (ทำครั้งเดียวตอน mount — localStorage มีเฉพาะฝั่งเบราว์เซอร์)
  useEffect(() => {
    const stored = readConsent();
    if (stored && !shouldShowConsent(stored)) {
      setConsent({ version: stored.version, acceptedAt: stored.acceptedAt });
    }
    setConsentChecked(true);
  }, []);

  // ด่านเดียวของทุกทางเข้า: ยังไม่ยอมรับ = เห็นจอข้อตกลงก่อนเสมอ
  // ?category=<Prob_name> จากการ์ดหมวดบนหน้าแรก → ตั้งหมวดไว้ แต่ข้ามด่านไม่ได้
  useEffect(() => {
    if (!router.isReady || !consentChecked || step !== "checking") return;
    const q = router.query.category;
    // กรองแค่ป้ายบริการ (SERVICE_LABELS) ไม่ได้เทียบกับเมนูจริง — หมวดมั่ว ๆ จึงยังเข้าขั้น 2 ได้
    // โดยไม่มีรายการปัญหาให้เลือก (พฤติกรรมเดิมก่อนมีด่านข้อตกลง คงไว้เหมือนเดิม)
    const fromCard = typeof q === "string" && q && !SERVICE_LABELS.includes(q) ? q : "";
    if (fromCard) setCategory(fromCard);
    if (!consent) setStep("consent");
    else setStep(fromCard ? 2 : 1);
  }, [router.isReady, router.query.category, consentChecked, consent, step]);

  // กดยอมรับ: จำไว้ในเครื่อง → ยิง log แบบไม่รอผล → เข้า wizard
  const handleAcceptConsent = () => {
    // ใช้ deviceId เดิมถ้าเคยยอมรับไว้ — ขึ้นข้อตกลงฉบับใหม่แล้วต้องยอมรับซ้ำ เครื่องเดิมจะยังนับเป็นเครื่องเดิมใน log
    const stored = writeConsent({ deviceId: readConsent()?.deviceId });
    setConsent({ version: stored.version, acceptedAt: stored.acceptedAt });
    // กติกาเดียว: log ฝั่งเซิร์ฟเวอร์คือหลักฐานหลักของการยอมรับ ส่วนสำเนาที่แนบไปกับเรื่องร้องเรียนเป็น best effort
    // จึงยิงแบบ fire-and-forget ไม่บล็อกผู้ใช้ แต่ต้องเห็นใน console เวลาเซิร์ฟเวอร์ตอบไม่ผ่าน
    // (เช่น app id ตั้งผิด = 400 ทุกครั้ง ซึ่งจะทำให้ log หายเงียบทั้งระบบถ้าไม่เตือน)
    void fetch("/api/complaints/consent-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": process.env.NEXT_PUBLIC_APP_ID || "app_b",
      },
      body: JSON.stringify(stored),
      keepalive: true,
    })
      .then((res) => {
        if (!res.ok) console.warn("consent-log ไม่สำเร็จ (HTTP " + res.status + ")");
      })
      .catch(() => {});
    setStep(category ? 2 : 1);
  };

  // ยืนยันยกเลิกคำร้อง: replace ทิ้ง /report?category=... ออกจากประวัติ หมวดที่ติดมาจากการ์ดจึงหายไปพร้อม URL
  // (ไม่ต้องล้าง state เอง — คอมโพเนนต์ถูก unmount ตอนเปลี่ยนหน้า state ตายไปด้วยอยู่แล้ว)
  const handleCancelConsent = () => {
    router.replace("/");
  };

  // ปุ่มย้อนกลับของทั้งจอข้อตกลงและขั้น 1 — เข้าหน้านี้ตรง ๆ (ลิงก์/QR) จะไม่มีประวัติให้ย้อน
  // router.back() เปล่า ๆ จะกลายเป็นปุ่มกดแล้วไม่ไปไหน จึงพากลับหน้าแรกแทน
  const goBackOrHome = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

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
        { prefix, fullName, phone, community, selectedProblems, category, imageUrls, detail, location, consent },
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
    if (step === 1) goBackOrHome();
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const meta = step === 1 || step === 2 || step === 3 ? STEP_META[step] : null;

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

        {step === "consent" && (
          <ConsentScreen
            onAccept={handleAcceptConsent}
            onExit={goBackOrHome}
            onCancel={handleCancelConsent}
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
              imageUrls={imageUrls}
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
