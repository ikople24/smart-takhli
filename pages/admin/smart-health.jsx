import { useEffect, useState, useMemo } from "react";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import { countStatuses } from "@/components/sm-health/StatusSmHealth";

// New Components
import WorkflowPipeline from "@/components/sm-health/WorkflowPipeline";
import EquipmentStats from "@/components/sm-health/EquipmentStats";
import QuickActions from "@/components/sm-health/QuickActions";
import DashboardTabs from "@/components/sm-health/DashboardTabs";

// Existing Components
import RequestTable from "@/components/sm-health/RequestTable";
import RegisterDeviceTable from "@/components/sm-health/RegisterDeviceTable";
import BorrowReturnTable from "@/components/sm-health/BorrowReturnTable";
import PersonDataTable from "@/components/sm-health/PersonDataTable";
import BorrowModal from "@/components/sm-health/BorrowModal";
import ReturnModal from "@/components/sm-health/ReturnModal";

export default function SmartHealthPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("request");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const { menu, fetchMenu } = useHealthMenuStore();

  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [borrows, setBorrows] = useState([]);

  // Modal States
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Fetch functions
  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/smart-health/ob-registration");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 800);
    }
  };

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/smart-health/registered-devices");
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchBorrows = async () => {
    try {
      const res = await fetch("/api/smart-health/borrow-return");
      const data = await res.json();
      setBorrows(data);
    } catch (err) {
      console.error("Failed to fetch borrow-return data", err);
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

  // Effects
  useEffect(() => {
    fetchRequests();
    fetchMenu();
  }, []);

  useEffect(() => {
    if (selectedTab === "register-device") {
      fetchDevices();
    }
    if (selectedTab === "borrow-return") {
      fetchBorrows();
    }
  }, [selectedTab]);

  // Computed values
  const statusCounts = useMemo(() => countStatuses(requests), [requests]);

  const filteredRequests = useMemo(() => {
    if (!selectedStatus) return requests;
    return requests.filter(
      (req) => (req.status || "รับคำร้อง") === selectedStatus
    );
  }, [requests, selectedStatus]);

  const tabCounts = useMemo(
    () => ({
      request: requests.length,
      "register-device": devices.length,
      "borrow-return": borrows.length,
    }),
    [requests, devices, borrows]
  );

  // Handlers
  const handleStatusClick = (status) => {
    setSelectedStatus(status);
    if (status) {
      setSelectedTab("request");
    }
  };

  const handleBorrow = () => {
    setShowBorrowModal(true);
  };

  const handleReturn = () => {
    setShowReturnModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Health Care Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              ระบบจัดการกายอุปกรณ์ เทศบาลเมืองตาคลี
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            อัปเดตล่าสุด: {new Date().toLocaleTimeString("th-TH")}
          </div>
        </div>

        {/* Quick Actions - Mobile First */}
        <div className="block sm:hidden">
          <QuickActions onBorrow={handleBorrow} onReturn={handleReturn} />
        </div>

        {/* Workflow Pipeline */}
        <WorkflowPipeline
          counts={statusCounts}
          selectedStatus={selectedStatus}
          onStatusClick={handleStatusClick}
        />

        {/* Two Column Layout for Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Equipment Stats - Takes 2 columns */}
          <div className="lg:col-span-2">
            <EquipmentStats menu={menu} loading={loading} />
          </div>

          {/* Quick Actions - Desktop */}
          <div className="hidden sm:block">
            <QuickActions onBorrow={handleBorrow} onReturn={handleReturn} />
          </div>
        </div>

        {/* Tabs & Content */}
        <DashboardTabs
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          counts={tabCounts}
        />

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <>
              {selectedTab === "request" && (
                <RequestTable
                  requests={filteredRequests}
                  menu={menu}
                  loading={loading}
                  onDelete={deleteRequest}
                  onUpdateStatus={updateStatus}
                />
              )}
              {selectedTab === "register-device" && (
                <RegisterDeviceTable devices={devices} loading={loadingDevices} />
              )}
              {selectedTab === "borrow-return" && (
                <BorrowReturnTable borrows={borrows} />
              )}
              {selectedTab === "people" && (
                <PersonDataTable />
              )}
            </>
          )}
        </div>
      </div>

      {/* Borrow Modal */}
      {showBorrowModal && (
        <BorrowModal
          onClose={() => setShowBorrowModal(false)}
          onSuccess={() => {
            setShowBorrowModal(false);
            fetchRequests();
            fetchMenu();
          }}
        />
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <ReturnModal
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            fetchRequests();
            fetchMenu();
          }}
        />
      )}
    </div>
  );
}
