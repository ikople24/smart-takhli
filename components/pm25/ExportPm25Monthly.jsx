import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Swal from "sweetalert2";
import { Download } from "lucide-react";

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatSyncedAt(syncedAt) {
  if (!syncedAt) return "";
  return new Date(syncedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function ExportPm25Monthly() {
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/pm25/monthly-report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");

      if (!data.months?.length) {
        Swal.fire("ไม่มีข้อมูล", "ยังไม่มีข้อมูลรายเดือน กรุณากด Sync เดือนก่อน", "info");
        return;
      }

      const headers = [
        "เดือน",
        "ปี (พ.ศ.)",
        "ค่าเฉลี่ย PM2.5 (µg/m³)",
        "จำนวนข้อมูล (ชม.)",
        "อัปเดตล่าสุด",
      ];
      const rows = data.months.map((m) => [
        m.fullName,
        m.year + 543,
        m.avg,
        m.count,
        formatSyncedAt(m.syncedAt),
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map(csvCell).join(",")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pm25-monthly-report-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      Swal.fire("ผิดพลาด", error.message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export CSV รายเดือน
    </button>
  );
}
