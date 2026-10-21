// modal QR เช็คอินรายคน (ลิงก์สาธารณะ /elderly/checkin — ห้ามเปลี่ยน path เพราะ QR พิมพ์แจกแล้ว)
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ElderlyModal, Notice, btnCls, primaryBtnCls } from "./elderlyTheme";

export function makeCheckinUrl(origin, personId, yearBE, displayName) {
  const qs = new URLSearchParams();
  qs.set("personId", String(personId));
  if (yearBE) qs.set("yearBE", String(yearBE));
  const label = displayName && String(displayName).trim();
  if (label) qs.set("n", label);
  return `${origin}/elderly/checkin?${qs.toString()}`;
}

export function siteOrigin() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin;
}

export default function QrCheckinModal({ open, onClose, person, yearBE }) {
  const [url, setUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const personId = person?.personId;
  const fullName = person?.fullName;

  useEffect(() => {
    if (!open || !personId) return;
    let alive = true;
    setError("");
    setCopied(false);
    setDataUrl("");
    const link = makeCheckinUrl(siteOrigin(), personId, yearBE, fullName);
    setUrl(link);
    import("qrcode")
      .then((m) => m.default.toDataURL(link, { margin: 1, width: 220 }))
      .then((d) => alive && setDataUrl(d))
      .catch((e) => alive && setError(e?.message || "สร้าง QR ไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [open, personId, fullName, yearBE]);

  return (
    <ElderlyModal
      open={open}
      onClose={onClose}
      title="QR เช็คอิน"
      subtitle={`${person?.fullName || ""} · ปี ${yearBE} · ผู้เรียนต้องยืนยันเลขบัตร 4 ตัวท้ายก่อนบันทึก`}
      footer={
        <>
          <a href={url || "#"} target="_blank" rel="noreferrer" className={btnCls + (url ? "" : " pointer-events-none opacity-50")}>
            เปิดลิงก์
          </a>
          <button
            type="button"
            className={primaryBtnCls}
            disabled={!url}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        {error && <Notice tone="see">{error}</Notice>}
        <div className="w-[236px] h-[236px] rounded-xl border border-[#E4E2DA] bg-[#FBFAF7] flex items-center justify-center">
          {dataUrl ? (
            <Image src={dataUrl} alt={`QR เช็คอินของ ${person?.fullName || ""}`} width={220} height={220} unoptimized />
          ) : (
            <span className="text-sm text-[#5B635F]">กำลังสร้าง QR...</span>
          )}
        </div>
        <input readOnly value={url} aria-label="ลิงก์เช็คอิน" className="w-full min-h-10 px-3 rounded-xl border border-[#D6D3C8] text-sm bg-[#FBFAF7]" />
      </div>
    </ElderlyModal>
  );
}
