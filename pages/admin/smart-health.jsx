import {
  CircleDot,
  Stethoscope,
  ClipboardCheck,
  PackageCheck,
} from "lucide-react";
import { countStatuses } from "@/components/sm-health/StatusSmHealth";
import { useEffect, useState } from "react";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import AvailableItems from "@/components/sm-health/AvailableItems";
import RequestTable from "@/components/sm-health/RequestTable";
import DemographicSummaryCards from "@/components/sm-health/DemographicSummaryCards";

export default function SmartHealthPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("request");
  const { menu, fetchMenu } = useHealthMenuStore();

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/smart-health/ob-registration");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      // ดีเลย์ก่อนค่อย setLoading(false)
      setTimeout(() => {
        setLoading(false);
      }, 1200); // 1200 ms หรือ 1.2 วินาที
    }
  };

  const deleteRequest = async (id) => {
    try {
      await fetch(`/api/smart-health/ob-registration?id=${id}`, {
        method: "DELETE",
      });
      setRequests((prev) => prev.filter((req) => req._id !== id));
    } catch (error) {
      console.error("Failed to delete request", error);
    }
  };

  const updateStatus = async (id, newStatus) => {
    console.log("Updating status for:", id, "to:", newStatus); // Add this line
    try {
      await fetch(`/api/smart-health/ob-registration?id=${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      setRequests((prev) =>
        prev.map((req) =>
          req._id === id ? { ...req, status: newStatus } : req
        )
      );
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMenu();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-500 text-transparent bg-clip-text animate-pulse">
        HEALTH-CARE-DASHBOARD
      </h1>
      <div className="flex justify-center mb-6 w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-center w-full max-w-5xl mx-auto px-2">
          {Object.entries(countStatuses(requests)).map(([status, count]) => {
            const borderColor =
              status === "รับคำร้อง"
                ? "border-yellow-500"
                : status === "ประเมินโดยพยาบาลวิชาชีพ"
                ? "border-blue-500"
                : status === "ลงทะเบียนอุปกรณ์"
                ? "border-orange-500"
                : status === "ส่งมอบอุปกรณ์"
                ? "border-green-500"
                : "border-gray-300";
            return (
              <div
                key={status}
                className={`bg-white ${borderColor} border-2 rounded-xl px-3 py-2 text-center shadow-md w-full sm:w-40 flex min-h-[5.5rem]`}
              >
                <div className="flex items-center space-x-2 text-left w-full">
                  <div>
                    {status === "รับคำร้อง" && (
                      <CircleDot size={30} className="text-yellow-500" />
                    )}
                    {status === "ประเมินโดยพยาบาลวิชาชีพ" && (
                      <Stethoscope size={30} className="text-blue-500" />
                    )}
                    {status === "ลงทะเบียนอุปกรณ์" && (
                      <ClipboardCheck size={30} className="text-orange-500" />
                    )}
                    {status === "ส่งมอบอุปกรณ์" && (
                      <PackageCheck size={30} className="text-green-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 break-words text-[0.85rem] leading-tight sm:text-sm">
                      {status}
                    </div>
                    <div className="text-primary text-xl font-bold">{count} ราย</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
          <DemographicSummaryCards />
      <AvailableItems menu={menu} loading={loading} />
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <div className="join w-full">
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="คำขออุปกรณ์"
            checked={selectedTab === "request"}
            onChange={() => setSelectedTab("request")}
          />
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="ข้อมูลบุคคล"
            checked={selectedTab === "person"}
            onChange={() => setSelectedTab("person")}
          />
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="ลงทะเบียนอุปกรณ์"
            checked={selectedTab === "register-device"}
            onChange={() => setSelectedTab("register-device")}
          />
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="ข้อมูลการยืม-คืนอุปกรณ์"
            checked={selectedTab === "borrow-return"}
            onChange={() => setSelectedTab("borrow-return")}
          />
          <div className="join-item flex-1"></div>
        </div>
      )}
      {selectedTab === "request" && (
        <RequestTable
          requests={requests}
          menu={menu}
          loading={loading}
          onDelete={deleteRequest}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  );
}
