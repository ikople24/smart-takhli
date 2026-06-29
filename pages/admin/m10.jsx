import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import IngestPanel from "@/components/m10/IngestPanel";
import ReviewPanel from "@/components/m10/ReviewPanel";
import RecordsPanel from "@/components/m10/RecordsPanel";
import WorklistPanel from "@/components/m10/WorklistPanel";
import SummaryPanel from "@/components/m10/SummaryPanel";

const TABS = [
  { key: "summary", label: "สรุปรายเดือน", Panel: SummaryPanel },
  { key: "ingest", label: "นำเข้าข้อมูล", Panel: IngestPanel },
  { key: "review", label: "คิวยืนยัน", Panel: ReviewPanel },
  { key: "records", label: "ทะเบียน (as-of)", Panel: RecordsPanel },
  { key: "worklist", label: "Worklist → LTAX", Panel: WorklistPanel },
];

export default function M10Page() {
  const router = useRouter();
  const initial = TABS.some((t) => t.key === router.query.tab) ? String(router.query.tab) : "summary";
  const [tab, setTab] = useState(initial);
  const Active = TABS.find((t) => t.key === tab)?.Panel ?? SummaryPanel;

  function go(key) {
    setTab(key);
    router.replace({ query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }

  return (
    <>
      <Head><title>แผนที่ภาษี (ม.10)</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">แผนที่ภาษี — งาน ม.10</h1>
        <div role="tablist" className="tabs tabs-lift mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              className={`tab ${tab === t.key ? "tab-active" : ""}`}
              onClick={() => go(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Active />
      </div>
    </>
  );
}
