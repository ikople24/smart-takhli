import { useEffect, useState, useMemo } from "react";
import { Circle } from "lucide-react";
import Papa from "papaparse";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

// URL สำหรับข้อมูล realtime
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv";

// URL สำหรับข้อมูลสรุปรายวัน (sheet All_day_24)
const DAILY_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv&gid=1506988263";

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
      aqiRange: "-"
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
      aqiRange: "0-25"
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
      aqiRange: "26-50"
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
      prevention: "[ประชาชนทั่วไป] สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ\n[ประชาชนในกลุ่มเสี่ยง] หากมีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง",
      aqi: "51-100",
      aqiRange: "51-100"
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
      prevention: "[ประชาชนทั่วไป] ควรเฝ้าระวังสุขภาพ ถ้ามีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น\n[ประชาชนในกลุ่มเสี่ยง] ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น ถ้ามีอาการทางสุขภาพ เช่น ไอ หายใจลำบาก ตาอักเสบ แน่นหน้าอก ปวดศีรษะ หัวใจเต้นไม่เป็นปกติ คลื่นไส้ อ่อนเพลีย ควรพบแพทย์",
      aqi: "101-200",
      aqiRange: "101-200"
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
    prevention: "ประชาชนทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง หลีกเลี่ยงพื้นที่ที่มีมลพิษทางอากาศสูง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น หากมีอาการทางสุขภาพควรพบแพทย์",
    aqi: ">200",
    aqiRange: ">200"
  };
};

// แปลงวันที่เป็นชื่อวัน
const getDayName = (dateStr) => {
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return days[date.getDay()];
  }
  return dateStr;
};

const Pm25Dashboard = () => {
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentInfo, setCurrentInfo] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

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

  // โหลดข้อมูล realtime
  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          setError(true);
        } else {
          setData(results.data);
          setError(false);
        }
      },
      error: (err) => {
        console.error("Error loading PM2.5 data:", err);
        setError(true);
      },
    });
  }, []);

  // โหลดข้อมูลสรุปรายวัน
  useEffect(() => {
    Papa.parse(DAILY_CSV_URL, {
      download: true,
      header: true,
      complete: (results) => {
        if (!results.errors || results.errors.length === 0) {
          setDailyData(results.data);
        }
      },
      error: (err) => {
        console.error("Error loading daily data:", err);
      },
    });
  }, []);

  // คำนวณข้อมูล 7 วันย้อนหลัง - ต้องเรียก useMemo ก่อน early returns
  const dailyAverages = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    
    const processed = dailyData
      .filter(row => row?.date_pm_sensor && row?.pm25_avg)
      .map(row => ({
        date: row.date_pm_sensor,
        avg: Math.round(parseFloat(row.pm25_avg) || 0),
        dayName: getDayName(row.date_pm_sensor),
      }))
      .filter(row => row.avg > 0)
      .sort((a, b) => {
        const parseDate = (d) => {
          const parts = d.split('/');
          if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
          return new Date(d);
        };
        return parseDate(b.date) - parseDate(a.date);
      })
      .slice(0, 7)
      .reverse();
    
    return processed;
  }, [dailyData]);

  // คำนวณข้อมูลรายเดือน 12 เดือน (เรียงจากเดือนปัจจุบันย้อนกลับไป)
  const monthlyAverages = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    // จัดกลุ่มข้อมูลตามเดือน
    const groupedByMonth = {};
    
    dailyData
      .filter(row => row?.date_pm_sensor && row?.pm25_avg)
      .forEach(row => {
        const parts = row.date_pm_sensor.split('/');
        if (parts.length === 3) {
          const month = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          const key = `${year}-${month.toString().padStart(2, '0')}`;
          const avg = parseFloat(row.pm25_avg);
          
          if (!isNaN(avg) && avg > 0) {
            if (!groupedByMonth[key]) {
              groupedByMonth[key] = { values: [], month, year };
            }
            groupedByMonth[key].values.push(avg);
          }
        }
      });
    
    // คำนวณค่าเฉลี่ยรายเดือน และเรียงจากล่าสุด(ซ้าย)ไปเก่าสุด(ขวา)
    const monthlyData = Object.entries(groupedByMonth)
      .map(([key, data]) => ({
        key,
        month: data.month,
        year: data.year,
        name: monthNames[data.month - 1],
        fullName: `${monthNames[data.month - 1]} ${data.year + 543}`, // พ.ศ.
        avg: Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length),
        count: data.values.length,
      }))
      .sort((a, b) => b.key.localeCompare(a.key)) // เรียงจากล่าสุดไปเก่าสุด
      .slice(0, 12); // เอา 12 เดือนล่าสุด (ธ.ค. อยู่ซ้าย, ม.ค. อยู่ขวา)
    
    return monthlyData;
  }, [dailyData]);

  const getLatestEntry = (dataArr) => {
    const reversed = [...dataArr].reverse();
    return reversed.find((row) => row?.pm25 && row?.Time);
  };

  // คำนวณค่าต่างๆ ก่อน early return
  const latest = getLatestEntry(data);
  const pm25Info = getPm25LevelInfo(latest?.pm25 || 0);
  const displayDate = latest?.date_select || currentDate;
  const isConnected = latest?.pm25 && parseFloat(latest.pm25) > 0;
  const pm25Value = isConnected ? parseInt(latest.pm25, 10) : 0;

  const handleClick = () => {
    setCurrentInfo(pm25Info);
    setShowModal(true);
  };

  // Loading state
  if (!mounted) {
    return (
      <div className="flex flex-col-2 justify-between mt-4 p-2 w-full max-w-[350px] h-[100px] mx-auto rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md">
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

  // Error state
  if (!latest || error) {
    const errorInfo = getPm25LevelInfo(0);
    
    return (
      <>
        <div 
          className={`flex flex-col-2 justify-between mt-4 p-2 w-full max-w-[350px] h-[100px] mx-auto rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md cursor-pointer hover:bg-white/40 transition-all duration-200 ${errorInfo.bgColor}`}
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
              อัพเดท : {currentDate} เวลา {currentTime}
            </p>
          </div>
          <div className="text-end">
            <span className={`font-medium text-5xl ${errorInfo.color}`}>00</span>
            <p className="text-md font-medium">µg/m³</p>
          </div>
        </div>

        {showModal && currentInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">ข้อมูลคุณภาพอากาศ</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <p className="text-gray-600">{currentInfo.meaning}</p>
                <div className="text-gray-700 text-sm whitespace-pre-line bg-gray-50 p-3 rounded">
                  {currentInfo.prevention}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col-2 justify-between mt-4 p-2 w-full max-w-[350px] h-[100px] mx-auto rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md cursor-pointer hover:bg-white/40 transition-all duration-200 ${pm25Info.bgColor}`}
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
          <span className={`font-medium text-5xl ${pm25Info.color}`}>
            {pm25Value}
          </span>
          <p className="text-md font-medium">µg/m³</p>
        </div>
      </div>

      {/* Modal สำหรับแสดงรายละเอียดและข้อมูล 7 วันย้อนหลัง */}
      {showModal && currentInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">ข้อมูลคุณภาพอากาศ</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
            </div>
            
            <div className="space-y-4">
              {/* ค่าปัจจุบัน */}
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

              {/* คำแนะนำ (อยู่ด้านบน) */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2 text-sm">💡 แนวทางการป้องกัน</h4>
                <div className="text-gray-700 text-sm whitespace-pre-line">
                  {currentInfo.prevention}
                </div>
              </div>

              {/* สรุป 7 วันย้อนหลัง แบบแนวนอน (อยู่ด้านล่าง) */}
              {dailyAverages.length > 0 && (
                <div className="border rounded-lg border-gray-300 p-3">
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm">
                    🫧 คุณภาพอากาศย้อนหลัง {dailyAverages.length} วัน
                  </h4>
                  
                  {/* การ์ดแนวนอน scroll ได้ - เรียงจากวันล่าสุด(ซ้าย)ไปวันเก่า(ขวา) */}
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                      {[...dailyAverages].reverse().map((day, index) => {
                        const dayInfo = getPm25LevelInfo(day.avg);
                        const dateParts = day.date.split('/');
                        const shortDate = dateParts.length >= 2 ? `${dateParts[0]}/${dateParts[1]}` : day.date;
                        const isToday = index === 0; // วันแรก (ซ้ายสุด) คือวันล่าสุด
                        
                        return (
                          <div 
                            key={index} 
                            className={`flex flex-col items-center p-2 rounded-lg min-w-[60px] relative ${
                              isToday 
                                ? 'bg-blue-50 border-2 border-blue-300' 
                                : 'bg-gray-50'
                            }`}
                          >
                            {/* ชื่อวัน */}
                            <span className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                              {day.dayName}
                            </span>
                            
                            {/* วันที่ */}
                            <span className={`text-xs mb-2 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                              {shortDate}
                            </span>
                            
                            {/* Badge ค่า AQI */}
                            <div 
                              className={`${dayInfo.badgeBg} text-white text-xs font-bold px-2 py-1 rounded mb-2`}
                            >
                              {day.avg}
                            </div>
                            
                            {/* ไอคอนสถานะ */}
                            {dayInfo.icon}
                            
                            {/* ป้าย "วันนี้" สำหรับวันล่าสุด */}
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

                  {/* สรุปสถิติ */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-3 border-t">
                    <div>
                      <p className="text-gray-500">ต่ำสุด</p>
                      <p className="font-bold text-green-600">
                        {Math.min(...dailyAverages.map(d => d.avg))}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">เฉลี่ย</p>
                      <p className="font-bold text-yellow-600">
                        {Math.round(dailyAverages.reduce((a, b) => a + b.avg, 0) / dailyAverages.length)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">สูงสุด</p>
                      <p className="font-bold text-red-600">
                        {Math.max(...dailyAverages.map(d => d.avg))}
                      </p>
                    </div>
                  </div>

                  {/* กราฟรายเดือน 12 เดือน */}
                  {monthlyAverages.length > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <h5 className="font-semibold text-gray-700 mb-3 text-xs">
                        📈 สรุปรายเดือน ({monthlyAverages.length} เดือน)
                      </h5>
                      
                      <div className="h-[150px] w-full">
                        {(() => {
                          // สร้าง gradient แบบแบ่งช่วงตามแต่ละเดือน
                          const totalMonths = monthlyAverages.length;
                          const colorStops = monthlyAverages.map((month, index) => {
                            const info = getPm25LevelInfo(month.avg);
                            const offset = totalMonths > 1 ? (index / (totalMonths - 1)) * 100 : 0;
                            return { offset, color: info.textColor };
                          });
                          
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={monthlyAverages} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                  {/* Gradient แนวนอนสำหรับเส้น */}
                                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                    {colorStops.map((stop, i) => (
                                      <stop 
                                        key={i} 
                                        offset={`${stop.offset}%`} 
                                        stopColor={stop.color} 
                                      />
                                    ))}
                                  </linearGradient>
                                  {/* Gradient แนวตั้งสำหรับ fill (ใช้สีผสมจากทุกเดือน) */}
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
                                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                                  axisLine={{ stroke: '#e5e7eb' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                                  axisLine={false}
                                  tickLine={false}
                                  domain={[0, 'auto']}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'white', 
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                  }}
                                  formatter={(value) => [`${value} µg/m³`, 'PM2.5']}
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

                      {/* สรุปสถิติรายเดือน */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                        <div className="bg-green-50 p-1.5 rounded">
                          <p className="text-gray-500 text-[10px]">ต่ำสุด</p>
                          <p className="font-bold text-green-600">
                            {Math.min(...monthlyAverages.map(d => d.avg))}
                          </p>
                        </div>
                        <div className="bg-yellow-50 p-1.5 rounded">
                          <p className="text-gray-500 text-[10px]">เฉลี่ย</p>
                          <p className="font-bold text-yellow-600">
                            {Math.round(monthlyAverages.reduce((a, b) => a + b.avg, 0) / monthlyAverages.length)}
                          </p>
                        </div>
                        <div className="bg-red-50 p-1.5 rounded">
                          <p className="text-gray-500 text-[10px]">สูงสุด</p>
                          <p className="font-bold text-red-600">
                            {Math.max(...monthlyAverages.map(d => d.avg))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs text-gray-500 text-center">
                อัพเดท: {displayDate} เวลา {latest.Time}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Pm25Dashboard;
