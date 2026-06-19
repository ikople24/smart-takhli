import { useEffect, useMemo, useState } from "react";
import { Circle } from "lucide-react";

const getNtuInfo = (value) => {
  const ntu = typeof value === "number" ? value : parseFloat(value);

  if (!Number.isFinite(ntu)) {
    return {
      color: "text-gray-500",
      bgColor: "bg-gray-100",
      icon: <Circle fill="#6b7280" stroke="#6b7280" size={10} />,
      label: "ไม่มีข้อมูล",
    };
  }

  // เกณฑ์น้ำจ่าย: <5 ปกติ, 5-15 เฝ้าระวัง, 15-20 ตะกอนเล็กน้อย, >20 เริ่มขุ่น
  if (ntu < 5) {
    return {
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      icon: <Circle fill="#2563eb" stroke="#2563eb" size={10} />,
      label: "น้ำใส (ปกติ)",
    };
  }

  if (ntu <= 15) {
    return {
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      icon: <Circle fill="#ca8a04" stroke="#ca8a04" size={10} />,
      label: "เฝ้าระวัง",
    };
  }

  if (ntu <= 20) {
    return {
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      icon: <Circle fill="#ea580c" stroke="#ea580c" size={10} />,
      label: "ตะกอนเล็กน้อย",
    };
  }

  return {
    color: "text-red-600",
    bgColor: "bg-red-50",
    icon: <Circle fill="#dc2626" stroke="#dc2626" size={10} />,
    label: "เริ่มขุ่น",
  };
};

const formatThaiDateShort = (ymd) => {
  if (!ymd || typeof ymd !== "string") return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = parseInt(m[1], 10) + 543;
  const mo = m[2];
  const d = m[3];
  return `${d}/${mo}/${y}`;
};

export default function WaterQualityCard({ className = "" } = {}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/smart-papar/water-quality/public-latest");
        const json = await res.json();
        if (!alive) return;
        setData(json?.success ? json.data : null);
      } catch {
        if (!alive) return;
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();
    const t = setInterval(run, 60_000); // refresh ทุก 1 นาที
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const ntuValue = data?.tapTurbidityNtu;
  const info = useMemo(() => getNtuInfo(ntuValue), [ntuValue]);
  const displayNtu = Number.isFinite(Number(ntuValue)) ? Number(ntuValue).toFixed(2) : "--";
  const tier = useMemo(() => {
    const ntu = Number(ntuValue);
    if (!Number.isFinite(ntu)) return "none";
    if (ntu < 5) return "ok";
    if (ntu <= 15) return "warn";
    if (ntu <= 20) return "warn2";
    return "bad";
  }, [ntuValue]);

  const fancyNumberClass =
    tier === "ok"
      ? "bg-gradient-to-br from-sky-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm"
      : info.color;

  return (
    <div
      className={`flex flex-col-2 justify-between p-2 w-full min-h-[100px] rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md transition-all duration-200 ${info.bgColor} ${className}`}
    >
      <div className="flex flex-col gap-2 justify-between min-w-0">
        <h2 className="text-base font-semibold text-gray-500 leading-tight break-words whitespace-normal">
          ค่าคุณภาพน้ำจ่าย
        </h2>
        <p className={`text-sm flex items-center gap-1 ${info.color}`}>
          {info.icon} {loading ? "กำลังโหลด..." : info.label}
        </p>
        {data?.recordDate ? (
          <p className="text-sm text-gray-400">อัปเดต: {formatThaiDateShort(data.recordDate)}</p>
        ) : (
          <p className="text-sm text-gray-400">{loading ? "" : " "}</p>
        )}
      </div>

      <div className="text-end flex-shrink-0">
        <span className={`font-medium text-5xl ${fancyNumberClass}`}>{displayNtu}</span>
        <p className="text-md font-medium">NTU</p>
      </div>
    </div>
  );
}


