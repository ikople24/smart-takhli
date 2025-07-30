import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import Papa from "papaparse";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv";

const getPm25LevelInfo = (value) => {
  const pm = parseFloat(value);
  
  // ตรวจสอบค่า null, undefined, NaN หรือ 0
  if (!pm || isNaN(pm) || pm === 0) {
    return { 
      color: "text-gray-500", 
      bgColor: "bg-gray-100",
      icon: <Circle fill="#6b7280" stroke="#6b7280" />, 
      label: "ไม่สามารถเชื่อมต่อได้",
      meaning: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
      prevention: "กรุณาลองใหม่อีกครั้งในภายหลัง"
    };
  }
  
  // ค่ามาตรฐานตามตาราง AQI ที่คุณแสดง
  if (pm <= 15.0) {
    return { 
      color: "text-blue-600", 
      bgColor: "bg-blue-50",
      icon: <Circle fill="#2563eb" stroke="#2563eb" />, 
      label: "คุณภาพอากาศดีมาก",
      meaning: "คุณภาพอากาศดีมาก",
      prevention: "คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งและการท่องเที่ยว",
      aqi: "0-25"
    };
  }
  
  if (pm <= 25.0) {
    return { 
      color: "text-green-600", 
      bgColor: "bg-green-50",
      icon: <Circle fill="#16a34a" stroke="#16a34a" />, 
      label: "คุณภาพอากาศดี",
      meaning: "คุณภาพอากาศดี",
      prevention: "คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งและท่องเที่ยวได้ตามปกติ",
      aqi: "26-50"
    };
  }
  
  if (pm <= 37.5) {
    return { 
      color: "text-yellow-600", 
      bgColor: "bg-yellow-50",
      icon: <Circle fill="#ca8a04" stroke="#ca8a04" />, 
      label: "คุณภาพอากาศปานกลาง",
      meaning: "คุณภาพอากาศปานกลาง",
      prevention: "[ประชาชนทั่วไป] สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ\n[ประชาชนในกลุ่มเสี่ยง] หากมีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง",
      aqi: "51-100"
    };
  }
  
  if (pm <= 75.0) {
    return { 
      color: "text-orange-600", 
      bgColor: "bg-orange-50",
      icon: <Circle fill="#ea580c" stroke="#ea580c" />, 
      label: "มีผลกระทบต่อสุขภาพ",
      meaning: "คุณภาพอากาศมีผลกระทบต่อสุขภาพ",
      prevention: "[ประชาชนทั่วไป] ควรเฝ้าระวังสุขภาพ ถ้ามีอาการเบื้องต้น เช่น ไอ หายใจลำบาก ระคายเคืองตา ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น\n[ประชาชนในกลุ่มเสี่ยง] ควรลดระยะเวลาการทำกิจกรรมกลางแจ้ง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น ถ้ามีอาการทางสุขภาพ เช่น ไอ หายใจลำบาก ตาอักเสบ แน่นหน้าอก ปวดศีรษะ หัวใจเต้นไม่เป็นปกติ คลื่นไส้ อ่อนเพลีย ควรพบแพทย์",
      aqi: "101-200"
    };
  }
  
  return { 
    color: "text-red-600", 
    bgColor: "bg-red-50",
    icon: <Circle fill="#dc2626" stroke="#dc2626" />, 
    label: "มีผลกระทบต่อสุขภาพมาก",
    meaning: "คุณภาพอากาศมีผลกระทบต่อสุขภาพมาก",
    prevention: "ประชาชนทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง หลีกเลี่ยงพื้นที่ที่มีมลพิษทางอากาศสูง หรือใช้อุปกรณ์ป้องกันตนเองหากมีความจำเป็น หากมีอาการทางสุขภาพควรพบแพทย์",
    aqi: ">200"
  };
};

const Pm25Dashboard = () => {
  const [data, setData] = useState([]);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentInfo, setCurrentInfo] = useState(null);

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
      error: (error) => {
        console.error("Error loading PM2.5 data:", error);
        setError(true);
      },
    });
  }, []);

  const getLatestEntry = (data) => {
    const reversed = [...data].reverse();
    return reversed.find((row) => row?.pm25 && row?.Time);
  };

  const latest = getLatestEntry(data);
  if (!latest || error) {
    const errorInfo = getPm25LevelInfo(0);
    const currentTime = new Date().toLocaleTimeString("th-TH");
    const currentDate = new Date().toLocaleDateString("th-TH");
    
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
            <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
            <p className={`text-sm flex items-center gap-1 ${errorInfo.color}`}>
              {errorInfo.icon} {errorInfo.label}
            </p>
            <p className="text-sm text-gray-400">
              อัพเดท : {currentDate} เวลา {currentTime}
            </p>
          </div>
          <div>
            <span className={`countdown font-medium text-6xl text-end ${errorInfo.color}`}>
              <span
                style={{ "--value": "0" }}
                aria-live="polite"
                aria-label="ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์"
              >
                00
              </span>
            </span>
            <p className="text-end text-md font-medium">µg/m³</p>
          </div>
        </div>

        {/* Modal สำหรับแสดงรายละเอียด Error */}
        {showModal && currentInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
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
                <div className="flex items-center gap-3">
                  {currentInfo.icon}
                  <div>
                    <p className={`font-semibold ${currentInfo.color}`}>{currentInfo.label}</p>
                    <p className="text-sm text-gray-600">ค่า PM2.5: 00 µg/m³</p>
                    {currentInfo.aqi && (
                      <p className="text-xs text-gray-500">AQI: {currentInfo.aqi}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">ความหมาย:</h4>
                  <p className="text-gray-700">{currentInfo.meaning}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">แนวทางการป้องกัน:</h4>
                  <div className="text-gray-700 whitespace-pre-line">
                    {currentInfo.prevention}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mt-4">
                  อัพเดท: {currentDate} เวลา {currentTime}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const pm25Info = getPm25LevelInfo(latest.pm25);
  const displayDate = latest.date_select || new Date().toLocaleDateString("th-TH");
  const isConnected = latest.pm25 && parseFloat(latest.pm25) > 0;

  const handleClick = () => {
    setCurrentInfo(pm25Info);
    setShowModal(true);
  };

  return (
    <>
      <div
        className={`flex flex-col-2 justify-between mt-4 p-2 w-full max-w-[350px] h-[100px] mx-auto rounded-xl shadow-md space-y-2 text-black bg-white/30 backdrop-blur-md cursor-pointer hover:bg-white/40 transition-all duration-200 ${pm25Info.bgColor}`}
        onClick={handleClick}
      >
        <div className="flex flex-col grap-2 justify-between">
          <h2 className="text-xl font-semibold text-gray-500">เช็คฝุ่นPM 2.5</h2>
          <p className={`text-sm flex items-center gap-1 ${pm25Info.color}`}>
            {pm25Info.icon} {pm25Info.label}
          </p>
          <p className="text-sm text-gray-400">
            อัพเดท : {displayDate} เวลา {latest.Time}
          </p>
        </div>
        <div>
          <span className={`countdown font-medium text-6xl text-end ${pm25Info.color}`}>
            <span
              style={{ "--value": isConnected ? parseInt(latest.pm25, 10).toString() : "0" }}
              aria-live="polite"
              aria-label={isConnected ? `ค่า PM2.5 คือ ${latest.pm25}` : "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์"}
            >
              {isConnected ? parseInt(latest.pm25, 10).toString() : "00"}
            </span>
          </span>
          <p className="text-end text-md font-medium">µg/m³</p>
        </div>
      </div>

      {/* Modal สำหรับแสดงรายละเอียด */}
      {showModal && currentInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
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
              <div className="flex items-center gap-3">
                {currentInfo.icon}
                <div>
                  <p className={`font-semibold ${currentInfo.color}`}>{currentInfo.label}</p>
                  <p className="text-sm text-gray-600">ค่า PM2.5: {isConnected ? latest.pm25 : "00"} µg/m³</p>
                  {currentInfo.aqi && (
                    <p className="text-xs text-gray-500">AQI: {currentInfo.aqi}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">ความหมาย:</h4>
                <p className="text-gray-700">{currentInfo.meaning}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">แนวทางการป้องกัน:</h4>
                <div className="text-gray-700 whitespace-pre-line">
                  {currentInfo.prevention}
                </div>
              </div>
              
              <div className="text-xs text-gray-500 mt-4">
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
