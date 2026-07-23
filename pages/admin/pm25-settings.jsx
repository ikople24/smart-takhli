import { useEffect, useState } from "react";
import Head from "next/head";
import { useAuth } from "@clerk/nextjs";
import Swal from "sweetalert2";
import { RefreshCw, Save, Cloud, Sheet, Radio } from "lucide-react";
import ExportPm25Monthly from "@/components/pm25/ExportPm25Monthly";

const MODE_OPTIONS = [
  {
    value: "sheet_with_api_fallback",
    label: "Sheet หลัก + DustBoy สำรอง (แนะนำ)",
    desc: "ใช้ Google Sheet ก่อน หากเชื่อมต่อไม่ได้จะสลับไป DustBoy อัตโนมัติ",
  },
  {
    value: "sheet_only",
    label: "Google Sheet เท่านั้น",
    desc: "ใช้เฉพาะข้อมูลจากเซ็นเซอร์เทศบาล (Sheet)",
  },
  {
    value: "api_only",
    label: "DustBoy API เท่านั้น",
    desc: "ใช้ DustBoy ชั่วคราวขณะเครื่อง PM ซ่อม",
  },
];

export default function Pm25SettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [dataMode, setDataMode] = useState("sheet_with_api_fallback");
  const [config, setConfig] = useState(null);
  const [cache, setCache] = useState(null);
  const [monthsTotal, setMonthsTotal] = useState(0);
  const [recentLogs, setRecentLogs] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [syncing, setSyncing] = useState(null);

  const authHeaders = async () => {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/pm25/settings", { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "โหลดไม่สำเร็จ");
      setDataMode(data.settings.dataMode);
      setUpdatedAt(data.settings.updatedAt);
      setConfig(data.config);
      setCache(data.cache);
      setMonthsTotal(data.monthsTotal || 0);
      setRecentLogs(data.recentLogs || []);
    } catch (err) {
      Swal.fire("ผิดพลาด", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/pm25/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({ dataMode }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      setUpdatedAt(data.settings.updatedAt);
      Swal.fire("สำเร็จ", "บันทึกการตั้งค่าแล้ว", "success");
    } catch (err) {
      Swal.fire("ผิดพลาด", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const runSync = async (job) => {
    setSyncing(job);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/pm25/settings?action=sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Sync ไม่สำเร็จ");
      await loadSettings();
      Swal.fire("สำเร็จ", `Sync ${job} เรียบร้อย`, "success");
    } catch (err) {
      Swal.fire("ผิดพลาด", err.message, "error");
    } finally {
      setSyncing(null);
    }
  };

  const runTest = async (target) => {
    setTesting(target);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/pm25/settings?action=test", {
        method: "POST",
        headers,
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "ทดสอบไม่สำเร็จ");
      setTestResults(data.results);
    } catch (err) {
      Swal.fire("ผิดพลาด", err.message, "error");
    } finally {
      setTesting(null);
    }
  };

  const statusBadge = (ok) =>
    ok ? (
      <span className="badge badge-success badge-sm">พร้อม</span>
    ) : (
      <span className="badge badge-error badge-sm">ล้มเหลว</span>
    );

  return (
    <>
      <Head>
        <title>จัดการ PM2.5 • SMART-TAKHLI</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🌫️ จัดการ PM2.5</h1>
              <p className="text-sm text-gray-600 mt-1">
                ตั้งค่าแหล่งข้อมูล Google Sheet และ DustBoy API
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={loadSettings}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <>
              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">โหมดแหล่งข้อมูล</h2>
                  {updatedAt && (
                    <p className="text-xs text-gray-500">
                      อัปเดตล่าสุด: {new Date(updatedAt).toLocaleString("th-TH")}
                    </p>
                  )}
                  <div className="space-y-3 mt-2">
                    {MODE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${
                          dataMode === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="dataMode"
                          className="radio radio-primary mt-1"
                          checked={dataMode === opt.value}
                          onChange={() => setDataMode(opt.value)}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{opt.label}</p>
                          <p className="text-sm text-gray-600">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="card-actions justify-end mt-4">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      บันทึก
                    </button>
                  </div>
                </div>
              </div>

              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">Cache MongoDB (หน้าแรกอ่านจากนี้)</h2>
                  {cache ? (
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>PM2.5 ล่าสุด: <strong>{cache.pm25}</strong> µg/m³</li>
                      <li>Sync ล่าสุด: {cache.syncedAt ? new Date(cache.syncedAt).toLocaleString("th-TH") : "-"}</li>
                      <li>7 วัน: {cache.daysCount} วัน (sync {cache.dailySyncedAt ? new Date(cache.dailySyncedAt).toLocaleString("th-TH") : "-"})</li>
                      <li>กราฟเดือน: {cache.monthsCount} เดือน</li>
                      {cache.stale && <li className="text-amber-600">ข้อมูลเก่ากว่า 2 ชม. — รอ cron hourly</li>}
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-600">ยังไม่มี cache — รัน Sync ชั่วโมงหรือตั้ง Railway Cron</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" className="btn btn-outline btn-xs" disabled={syncing !== null || !config?.hasDustboyApiKey} onClick={() => runSync("hourly")}>
                      {syncing === "hourly" ? "..." : "Sync ชั่วโมง"}
                    </button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={syncing !== null || !config?.hasDustboyApiKey} onClick={() => runSync("daily")}>
                      {syncing === "daily" ? "..." : "Sync 7 วัน"}
                    </button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={syncing !== null || !config?.hasDustboyApiKey} onClick={() => runSync("monthly")}>
                      {syncing === "monthly" ? "..." : "Sync เดือน"}
                    </button>
                  </div>
                  {recentLogs.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      <p className="font-medium mb-1">Log ล่าสุด</p>
                      {recentLogs.map((l, i) => (
                        <p key={i}>{l.job}: {l.success ? "OK" : "FAIL"} — {l.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">รายงานรายเดือน</h2>
                  <p className="text-sm text-gray-600">
                    Export ค่าเฉลี่ย PM2.5 รายเดือนทั้งหมดที่เก็บไว้ ({monthsTotal} เดือน)
                    เป็นไฟล์ CSV แบบ UTF-8 + BOM เปิดใน Excel ภาษาไทยไม่เพี้ยน
                  </p>
                  <div className="card-actions justify-end mt-2">
                    <ExportPm25Monthly />
                  </div>
                </div>
              </div>

              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">Railway Cron</h2>
                  <p className="text-sm text-gray-600 mb-2">
                    ตั้ง Cron Job ใน Railway ให้ POST มาที่ URL ของแอป (ใส่ <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> ใน Variables)
                  </p>
                  <ul className="text-xs font-mono space-y-2 bg-gray-50 p-3 rounded-lg break-all">
                    <li><span className="text-gray-500">ทุกชม. นาที 5:</span><br />POST /api/cron/pm25/sync-hourly?secret=CRON_SECRET</li>
                    <li><span className="text-gray-500">ทุกวัน 00:15 (ไทย):</span><br />POST /api/cron/pm25/sync-daily?secret=CRON_SECRET</li>
                    <li><span className="text-gray-500">ทุกวัน 03:00 (ไทย, เดือนใหม่):</span><br />POST /api/cron/pm25/sync-monthly?secret=CRON_SECRET</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">Timezone ใน Railway Cron: ตั้งเป็น Asia/Bangkok</p>
                </div>
              </div>

              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">สถานะการเชื่อมต่อ</h2>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Sheet className="w-4 h-4 text-green-600" />
                      Google Sheet (realtime)
                    </li>
                    <li className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-600" />
                      DustBoy API key:{" "}
                      {config?.hasDustboyApiKey ? (
                        <span className="text-green-600">ตั้งค่าแล้ว (env)</span>
                      ) : (
                        <span className="text-red-600">ยังไม่ได้ตั้ง DUSTBOY_API_KEY</span>
                      )}
                    </li>
                    <li className="text-gray-500 pl-6">
                      Station ID: {config?.stationId || "3550"}
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    ใส่ <code className="bg-gray-100 px-1 rounded">DUSTBOY_API_KEY</code> และ{" "}
                    <code className="bg-gray-100 px-1 rounded">DUSTBOY_STATION_ID</code> ในไฟล์
                    environment ของเซิร์ฟเวอร์ (ไม่เก็บในโค้ด)
                  </p>
                </div>
              </div>

              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">ทดสอบการเชื่อมต่อ</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={testing !== null}
                      onClick={() => runTest("sheet")}
                    >
                      <Sheet className="w-4 h-4" />
                      ทดสอบ Sheet
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={testing !== null || !config?.hasDustboyApiKey}
                      onClick={() => runTest("dustboy")}
                    >
                      <Cloud className="w-4 h-4" />
                      ทดสอบ DustBoy
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={testing !== null}
                      onClick={() => runTest("dashboard")}
                    >
                      <Radio className="w-4 h-4" />
                      ทดสอบโหมดปัจจุบัน
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={testing !== null}
                      onClick={() => runTest("both")}
                    >
                      ทดสอบทั้งหมด
                    </button>
                  </div>

                  {testResults && (
                    <div className="mt-4 space-y-3 text-sm">
                      {testResults.sheet && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">Google Sheet</span>
                            {statusBadge(testResults.sheet.ok)}
                          </div>
                          {testResults.sheet.ok ? (
                            <p>
                              PM2.5: {testResults.sheet.pm25} µg/m³ — {testResults.sheet.date}{" "}
                              {testResults.sheet.time}
                            </p>
                          ) : (
                            <p className="text-red-600">{testResults.sheet.error}</p>
                          )}
                        </div>
                      )}
                      {testResults.dustboy && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">DustBoy API</span>
                            {statusBadge(testResults.dustboy.ok)}
                          </div>
                          {testResults.dustboy.ok ? (
                            <p>
                              PM2.5: {testResults.dustboy.pm25} µg/m³ — {testResults.dustboy.station}
                            </p>
                          ) : (
                            <p className="text-red-600">{testResults.dustboy.error}</p>
                          )}
                        </div>
                      )}
                      {testResults.dashboard && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">Dashboard (ตามโหมดที่บันทึก)</span>
                            {statusBadge(testResults.dashboard.ok)}
                          </div>
                          {testResults.dashboard.ok ? (
                            <p>
                              แหล่ง: {testResults.dashboard.source}
                              {testResults.dashboard.fallback ? " (fallback)" : ""} — PM2.5:{" "}
                              {testResults.dashboard.pm25}
                            </p>
                          ) : (
                            <p className="text-red-600">{testResults.dashboard.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </>
  );
}
