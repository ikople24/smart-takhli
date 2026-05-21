import { useEffect, useState, useCallback } from "react";
import { Circle } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const getPm25LevelInfo = (value) => {
  const pm = parseFloat(value);

  if (!pm || isNaN(pm) || pm === 0) {
    return {
      color: "text-gray-500",
      textColor: "#6b7280",
      bgColor: "bg-gray-100",
      badgeBg: "bg-gray-400",
      icon: <Circle fill="#6b7280" stroke="#6b7280" size={10} />,
      label: "ไม่สามารถเชื่อมต่อได้",
      meaning: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
      prevention: "กรุณาลองใหม่อีกครั้งในภายหลัง",
      aqiRange: "-",
    };
  }

  if (pm <= 15.0) {
    return {
      color: "text-blue-600",
      textColor: "#2563eb",
      bgColor: "bg-blue-50",
      badgeBg: "bg-blue-500",
      icon: <Circle fill="#2563eb" stroke="#2563eb" size={10} />,
      label: "คุณภาพอากาศดีมาก",
      meaning: "คุณภาพอากาศดีมาก",
      prevention: "คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งและการท่องเที่ยว",
      aqi: "0-25",
      aqiRange: "0-25",
    };
  }

  if (pm <= 25.0) {
    return {
      color: "text-green-600",
      textColor: "#16a34a",
      bgColor: "bg-green-50",
      badgeBg: "bg-green-500",
      icon: <Circle fill="#16a34a" stroke="#16a34a" size={10} />,
      label: "คุณภาพอากาศดี",
      meaning: "คุณภาพอากาศดี",
      prevention: "คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ",
      aqi: "26-50",
      aqiRange: "26-50",
    };
  }

  if (pm <= 37.5) {
    return {
      color: "text-yellow-600",
      textColor: "#ca8a04",
      bgColor: "bg-yellow-50",
      badgeBg: "bg-yellow-500",
      icon: <Circle fill="#ca8a04" stroke="#ca8a04" size={10} />,
      label: "คุณภาพอากาศปานกลาง",
      meaning: "คุณภาพอากาศปานกลาง",
      prevention:
        "[ประชาชนทั่วไป] สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ\n[ประชาชนในกลุ่มเสี่ยง] หากมีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง",
      aqi: "51-100",
      aqiRange: "51-100",
    };
  }

  if (pm <= 75.0) {
    return {
      color: "text-orange-600",
      textColor: "#ea580c",
      bgColor: "bg-orange-50",
      badgeBg: "bg-orange-500",
      icon: <Circle fill="#ea580c" stroke="#ea580c" size={10} />,
      label: "มีผลกระทบต่อสุขภาพ",
      meaning: "คุณภาพอากาศมีผลกระทบต่อสุขภาพ",
      prevention:
        "[ประชาชนทั่วไป] ควรเฝ้าระวังสุขภาพ ถ้ามีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น\n[ประชาชนในกลุ่มเสี่ยง] ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น ถ้ามีอาการทางสุขภาพ เช่น ไอ หายใจลำบาก ตาอักเสบ แน่นหน้าอก ปวดศีรษะ หัวใจเต้นไม่เป็นปกติ คลื่นไส้ อ่อนเพลีย ควรพบแพทย์",
      aqi: "101-200",
      aqiRange: "101-200",
    };
  }

  return {
    color: "text-red-600",
    textColor: "#dc2626",
    bgColor: "bg-red-50",
    badgeBg: "bg-red-500",
    icon: <Circle fill="#dc2626" stroke="#dc2626" size={10} />,
    label: "มีผลกระทบต่อสุขภาพมาก",
    meaning: "คุณภาพอากาศมีผลกระทบต่อสุขภาพมาก",
    prevention:
      "ประชาชนทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง หลีกเลี่ยงพื้นที่ที่มีมลพิษทางอากาศสูง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น หากมีอาการทางสุขภาพควรพบแพทย์",
    aqi: ">200",
    aqiRange: ">200",
  };
};

const Pm25Dashboard = ({ className = "" } = {}) => {
  const [latest, setLatest] = useState(null);
  const [dailyAverages, setDailyAverages] = useState([]);
  const [monthlyAverages, setMonthlyAverages] = useState([]);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentInfo, setCurrentInfo] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/pm25/dashboard", { cache: "no-store" });
      const data = await res.json();
      if (!data.success || !data.latest) {
        setError(true);
        setErrorMessage(data.error || "ไม่สามารถโหลดข้อมูลได้");
        setLatest(null);
        setDailyAverages(data.dailyAverages || []);
        setMonthlyAverages(data.monthlyAverages || []);
        return;
      }
      setLatest(data.latest);
      setDailyAverages(data.dailyAverages || []);
      setMonthlyAverages(data.monthlyAverages || []);
      setError(false);
      setErrorMessage("");
    } catch (err) {
      console.error("Error loading PM2.5 data:", err);
      setError(true);
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString("th-TH"));
      setCurrentDate(new Date().toLocaleDateString("th-TH"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
    const refresh = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(refresh);
  }, [loadData]);

  const pm25Info = getPm25LevelInfo(latest?.pm25 || 0);
  const displayDate = latest?.date_select || currentDate;
  const isConnected = latest?.pm25 && parseFloat(latest.pm25) > 0;
  const pm25Value = isConnected ? parseInt(latest.pm25, 10) : 0;

  const handleClick = () => {
    setCurrentInfo(pm25Info);
    setShowModal(true);
  };

  const modalContent = showModal && currentInfo && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">ข้อมูลคุณภาพอากาศ</h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${currentInfo.bgColor}`}>
            {currentInfo.icon}
            <div className="flex-1">
              <p className={`font-semibold ${currentInfo.color}`}>{currentInfo.label}</p>
              <p className="text-sm text-gray-600">ค่าปัจจุบัน</p>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-bold ${currentInfo.color}`}>{pm25Value}</span>
              <p className="text-xs text-gray-500">µg/m³</p>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm">💡 แนวทางการป้องกัน</h4>
            <div className="text-gray-700 text-sm whitespace-pre-line">
              {currentInfo.prevention}
            </div>
          </div>

          {dailyAverages.length > 0 && (
            <div className="border rounded-lg border-gray-300 p-3">
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">
                🫧 คุณภาพอากาศย้อนหลัง {dailyAverages.length} วัน
              </h4>

              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2" style={{ minWidth: "max-content" }}>
                  {[...dailyAverages].reverse().map((day, index) => {
                    const dayInfo = getPm25LevelInfo(day.avg);
                    const dateParts = day.date.split("/");
                    const shortDate =
                      dateParts.length >= 2 ? `${dateParts[0]}/${dateParts[1]}` : day.date;
                    const isToday = index === 0;

                    return (
                      <div
                        key={index}
                        className={`flex flex-col items-center p-2 rounded-lg min-w-[60px] relative ${
                          isToday ? "bg-blue-50 border-2 border-blue-300" : "bg-gray-50"
                        }`}
                      >
                        <span
                          className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : "text-gray-600"}`}
                        >
                          {day.dayName}
                        </span>
                        <span
                          className={`text-xs mb-2 ${isToday ? "text-blue-400" : "text-gray-400"}`}
                        >
                          {shortDate}
                        </span>
                        <div
                          className={`${dayInfo.badgeBg} text-white text-xs font-bold px-2 py-1 rounded mb-2`}
                        >
                          {day.avg}
                        </div>
                        {dayInfo.icon}
                        {isToday && (
                          <span className="text-[10px] text-blue-500 mt-1 font-medium">
                            วันนี้
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-3 border-t">
                <div>
                  <p className="text-gray-500">ต่ำสุด</p>
                  <p className="font-bold text-green-600">
                    {Math.min(...dailyAverages.map((d) => d.avg))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">เฉลี่ย</p>
                  <p className="font-bold text-yellow-600">
                    {Math.round(
                      dailyAverages.reduce((a, b) => a + b.avg, 0) / dailyAverages.length
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">สูงสุด</p>
                  <p className="font-bold text-red-600">
                    {Math.max(...dailyAverages.map((d) => d.avg))}
                  </p>
                </div>
              </div>

              {monthlyAverages.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <h5 className="font-semibold text-gray-700 mb-3 text-xs">
                    📈 สรุปรายเดือน ({monthlyAverages.length} เดือน)
                  </h5>

                  <div className="h-[150px] w-full">
                    {(() => {
                      const totalMonths = monthlyAverages.length;
                      const colorStops = monthlyAverages.map((month, index) => {
                        const info = getPm25LevelInfo(month.avg);
                        const offset = totalMonths > 1 ? (index / (totalMonths - 1)) * 100 : 0;
                        return { offset, color: info.textColor };
                      });

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={monthlyAverages}
                            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                          >
                            <defs>
                              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                {colorStops.map((stop, i) => (
                                  <stop
                                    key={i}
                                    offset={`${stop.offset}%`}
                                    stopColor={stop.color}
                                  />
                                ))}
                              </linearGradient>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="1" y2="0">
                                {colorStops.map((stop, i) => (
                                  <stop
                                    key={i}
                                    offset={`${stop.offset}%`}
                                    stopColor={stop.color}
                                    stopOpacity={0.25}
                                  />
                                ))}
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "#9ca3af" }}
                              axisLine={{ stroke: "#e5e7eb" }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#9ca3af" }}
                              axisLine={false}
                              tickLine={false}
                              domain={[0, "auto"]}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                fontSize: "12px",
                                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                              }}
                              formatter={(value) => [`${value} µg/m³`, "PM2.5"]}
                              labelFormatter={(label, payload) => {
                                if (payload && payload[0]) {
                                  return `เดือน ${payload[0].payload.fullName || label}`;
                                }
                                return `เดือน ${label}`;
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="avg"
                              stroke="url(#lineGradient)"
                              strokeWidth={2.5}
                              fill="url(#areaGradient)"
                              dot={(props) => {
                                const { cx, cy, payload } = props;
                                const info = getPm25LevelInfo(payload.avg);
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={info.textColor}
                                    stroke="#fff"
                                    strokeWidth={1.5}
                                  />
                                );
                              }}
                              activeDot={(props) => {
                                const { cx, cy, payload } = props;
                                const info = getPm25LevelInfo(payload.avg);
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={6}
                                    fill={info.textColor}
                                    stroke="#fff"
                                    strokeWidth={2}
                                  />
                                );
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                    <div className="bg-green-50 p-1.5 rounded">
                      <p className="text-gray-500 text-[10px]">ต่ำสุด</p>
                      <p className="font-bold text-green-600">
                        {Math.min(...monthlyAverages.map((d) => d.avg))}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-1.5 rounded">
                      <p className="text-gray-500 text-[10px]">เฉลี่ย</p>
                      <p className="font-bold text-yellow-600">
                        {Math.round(
                          monthlyAverages.reduce((a, b) => a + b.avg, 0) /
                            monthlyAverages.length
                        )}
                      </p>
                    </div>
                    <div className="bg-red-50 p-1.5 rounded">
                      <p className="text-gray-500 text-[10px]">สูงสุด</p>
                      <p className="font-bold text-red-600">
                        {Math.max(...monthlyAverages.map((d) => d.avg))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {latest && (
            <div className="text-xs text-gray-500 text-center">
              อัพเดท: {displayDate} เวลา {latest.Time}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted || loading) {
    return (
      <div
        className={`flex flex-col-2 justify-between p-2 w-full min-h-[100px] rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md ${className}`}
      >
        <div className="flex flex-col gap-2 justify-between">
          <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        </div>
        <div className="text-end">
          <span className="font-medium text-5xl text-gray-400">--</span>
          <p className="text-md font-medium">µg/m³</p>
        </div>
      </div>
    );
  }

  if (!latest || error) {
    const errorInfo = getPm25LevelInfo(0);

    return (
      <>
        <div
          className={`flex flex-col-2 justify-between p-2 w-full min-h-[100px] rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md cursor-pointer hover:bg-white/40 transition-all duration-200 ${errorInfo.bgColor} ${className}`}
          onClick={() => {
            setCurrentInfo(errorInfo);
            setShowModal(true);
          }}
        >
          <div className="flex flex-col gap-2 justify-between">
            <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
            <p className={`text-sm flex items-center gap-1 ${errorInfo.color}`}>
              {errorInfo.icon} {errorInfo.label}
            </p>
            <p className="text-sm text-gray-400">
              {errorMessage || `อัพเดท : ${currentDate} เวลา ${currentTime}`}
            </p>
          </div>
          <div className="text-end">
            <span className={`font-medium text-5xl ${errorInfo.color}`}>00</span>
            <p className="text-md font-medium">µg/m³</p>
          </div>
        </div>
        {modalContent}
      </>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col-2 justify-between p-2 w-full min-h-[100px] rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md cursor-pointer hover:bg-white/40 transition-all duration-200 ${pm25Info.bgColor} ${className}`}
        onClick={handleClick}
      >
        <div className="flex flex-col grap-2 justify-between">
          <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
          <p className={`text-sm flex items-center gap-1 ${pm25Info.color}`}>
            {pm25Info.icon} {pm25Info.label}
          </p>
          <p className="text-sm text-gray-400">
            อัพเดท : {displayDate} เวลา {latest.Time}
          </p>
        </div>
        <div className="text-end">
          <span className={`font-medium text-5xl ${pm25Info.color}`}>{pm25Value}</span>
          <p className="text-md font-medium">µg/m³</p>
        </div>
      </div>
      {modalContent}
    </>
  );
};

export default Pm25Dashboard;
