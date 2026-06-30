import Head from "next/head";
import dynamic from "next/dynamic";

const BasemapEditor = dynamic(() => import("@/components/m10/basemap/BasemapEditor"), {
  ssr: false,
  loading: () => <div className="p-6">กำลังโหลดแผนที่…</div>,
});

export default function M10BasemapPage() {
  return (
    <>
      <Head><title>แก้รูปแปลง basemap (ม.10)</title></Head>
      <BasemapEditor />
    </>
  );
}
