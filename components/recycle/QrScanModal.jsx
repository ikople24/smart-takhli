// สแกน QR บัตรสมาชิกด้วยกล้องในหน้าเว็บ (ไม่ต้องสลับไปแอปกล้อง)
// อ่านได้ → หา member จาก token → พาไปหน้ากรอกน้ำหนัก /admin/recycle/deposit?code=PS-xxxx
// กล้องใช้ได้เฉพาะ https (หรือ localhost) และครั้งแรก browser จะขออนุญาตใช้กล้อง
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { recycleFetch } from "@/lib/recycle/client";
import { parseScannedCard } from "@/lib/recycle/scan";
import { DISPLAY } from "@/lib/recycle/theme";

const CLOSE_ICON = "M6 6l12 12M18 6L6 18";

function cameraErrorMessage(err) {
  const name = err?.name || "";
  const msg = String(err?.message || err || "");
  if (name === "NotAllowedError" || /permission|denied/i.test(msg)) {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องให้เว็บนี้ในการตั้งค่า browser แล้วลองใหม่";
  }
  if (name === "NotFoundError" || /no camera|not found/i.test(msg)) return "ไม่พบกล้องบนอุปกรณ์นี้";
  if (typeof window !== "undefined" && !window.isSecureContext) return "กล้องใช้ได้เฉพาะเว็บที่เป็น https";
  return "เปิดกล้องไม่สำเร็จ — ลองปิดแอปอื่นที่ใช้กล้องอยู่ หรือใช้ช่องค้นหาสมาชิกแทน";
}

export default function QrScanModal({ open, onClose }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const handlingRef = useRef(false);
  const [status, setStatus] = useState("starting"); // starting | scanning | found | error
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    handlingRef.current = false;
    setStatus("starting");
    setMessage("");
    setHint("");

    const handleResult = async (text) => {
      if (handlingRef.current) return;
      const parsed = parseScannedCard(text);
      if (!parsed) {
        setHint("QR นี้ไม่ใช่บัตรสมาชิกพระสังข์หอบทอง");
        return;
      }
      handlingRef.current = true;
      setHint("");
      setStatus("found");
      scannerRef.current?.stop();
      try {
        navigator.vibrate?.(60);
      } catch {
        // บาง browser ไม่รองรับ
      }
      try {
        let code = parsed.code;
        if (parsed.token) {
          const json = await recycleFetch(`/members?token=${encodeURIComponent(parsed.token)}`);
          code = json.member?.code;
        }
        if (!code) throw new Error("ไม่พบสมาชิก");
        if (cancelled) return;
        router.push(`/admin/recycle/deposit?code=${encodeURIComponent(code)}`);
      } catch (e) {
        if (cancelled) return;
        setHint(e.status === 404 ? "ไม่พบสมาชิกของบัตรใบนี้ (บัตรอาจถูกออกใหม่แล้ว)" : e.message);
        setStatus("scanning");
        handlingRef.current = false;
        scannerRef.current?.start().catch(() => {});
      }
    };

    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;
        const scanner = new QrScanner(videoRef.current, (r) => handleResult(r.data), {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          maxScansPerSecond: 8,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setStatus("scanning");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(cameraErrorMessage(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label="สแกนบัตรสมาชิก">
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <p className={`${DISPLAY} text-lg font-semibold`}>สแกนบัตรสมาชิก</p>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
          aria-label="ปิดกล้อง"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d={CLOSE_ICON} />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* qr-scanner วาดกรอบเล็ง/เส้นขอบ QR ทับวิดีโอเอง (highlightScanRegion) */}
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {status === "starting" && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">กำลังเปิดกล้อง…</p>
        )}
        {status === "found" && (
          <p className="absolute inset-0 flex items-center justify-center bg-black/60 text-base font-medium">
            อ่านบัตรได้แล้ว กำลังเปิดหน้ากรอกน้ำหนัก…
          </p>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black">
            <p className="text-base leading-relaxed">{message}</p>
            <button type="button" onClick={onClose} className="px-5 h-11 rounded-full bg-white text-[#146C43] font-semibold">
              กลับไปค้นหาด้วยชื่อ/รหัส
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pt-4 pb-8 text-center">
        {hint ? (
          <p className="text-sm text-[#F4B740] font-medium">{hint}</p>
        ) : (
          <p className="text-sm text-white/75">เล็ง QR บนบัตรให้อยู่ในกรอบ ระบบจะอ่านให้เอง</p>
        )}
      </div>
    </div>
  );
}
