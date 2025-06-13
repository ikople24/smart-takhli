import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import Papa from "papaparse";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv";

const getPm25LevelInfo = (value) => {
  const pm = parseFloat(value);
  if (pm <= 25) return { color: "text-green-500", icon: <Circle fill="#22c55e" stroke="#22c55e" />, label: "อากาศดีมาก" };
  if (pm <= 50) return { color: "text-yellow-400", icon: <Circle fill="#facc15" stroke="#facc15" />, label: "ปานกลาง" };
  if (pm <= 100) return { color: "text-orange-400", icon: <Circle fill="#fb923c" stroke="#fb923c" />, label: "เริ่มมีผลกระทบ" };
  if (pm <= 150) return { color: "text-red-500", icon: <Circle fill="#ef4444" stroke="#ef4444" />, label: "มีผลกระทบต่อสุขภาพ" };
  return { color: "text-purple-700", icon: <Circle fill="#7e22ce" stroke="#7e22ce" />, label: "อันตรายมาก" };
};

const Pm25Dashboard = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      complete: (results) => {
        setData(results.data);
      },
    });
  }, [data]);

  const getLatestEntry = (data) => {
    const reversed = [...data].reverse();
    return reversed.find((row) => row?.pm25 && row?.Time);
  };

  const latest = getLatestEntry(data);
  if (!latest)
    return (
      <div className="flex justify-center items-center h-[100px]">
        <span className="loading loading-dots loading-md"></span>
      </div>
    );

  const { color, icon, label } = getPm25LevelInfo(latest.pm25);
  const displayDate = latest.date_select || new Date().toLocaleDateString("th-TH");

  return (
    <div
      className={`flex flex-col-2 justify-between mt-4 p-2 w-full max-w-[350px] h-[100px] mx-auto rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md`}
    >
      <div className="flex flex-col grap-2 justify-between">
        <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
        <p className="text-sm text-gray-500 flex items-center gap-1">{icon} {label}</p>
        <p className="text-sm text-gray-400">
          อัพเดท : {displayDate} เวลา {latest.Time}
        </p>
      </div>
      <div>
        <span className={`countdown font-medium text-6xl text-end ${color}`}>
          <span
            style={{ "--value": parseInt(latest.pm25, 10).toString() }}
            aria-live="polite"
            aria-label={`ค่า PM2.5 คือ ${latest.pm25}`}
          >
            {parseInt(latest.pm25, 10).toString()}
          </span>
        </span>
        <p className="text-end text-md font-medium">µg/m³</p>
      </div>

      {/* <div className="flex flex-wrap justify-center gap-4 text-sm mt-4 font-semibold">
          <span>🌫️ PM1: {latest.pm1}</span>
          <span>🌪️ PM10: {latest.pm10}</span>
          <span>🌡️ อุณหภูมิ: {latest.Temp}°C</span>
          <span>💧 ความชื้น: {latest.Humidity}%</span>
        </div> */}
    </div>
  );
};

export default Pm25Dashboard;
