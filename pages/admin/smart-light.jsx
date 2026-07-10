// หน้าเสาไฟสาธารณะ (กองช่าง) — แผนที่ทะเบียนเสา + สำรวจ/แก้ไข/เพิ่ม/จัดกลุ่ม
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import PoleBottomSheet from "@/components/smart-light/PoleBottomSheet";
import SurveyModal from "@/components/smart-light/SurveyModal";
import AddPoleModal from "@/components/smart-light/AddPoleModal";
import GroupRenameModal from "@/components/smart-light/GroupRenameModal";
import SearchPanel from "@/components/smart-light/SearchPanel";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const SmartLightMap = dynamic(() => import("@/components/smart-light/SmartLightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400">
      กำลังโหลดแผนที่…
    </div>
  ),
});
const EditPoleModal = dynamic(() => import("@/components/smart-light/EditPoleModal"), {
  ssr: false,
});

export default function SmartLightPage() {
  const [poles, setPoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedPole, setSelectedPole] = useState(null); // ข้อมูลเต็ม (รวม surveys)
  const [sheetLoading, setSheetLoading] = useState(false);
  const [surveyPole, setSurveyPole] = useState(null);
  const [editPole, setEditPole] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [pickedLatLng, setPickedLatLng] = useState(null);
  const [addFormOpen, setAddFormOpen] = useState(false);

  const [focusTarget, setFocusTarget] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoadError("");
      const [polesRes, groupsRes] = await Promise.all([
        fetch("/api/smart-light/poles").then((r) => r.json()),
        fetch("/api/smart-light/groups").then((r) => r.json()),
      ]);
      if (!polesRes.success) throw new Error(polesRes.message);
      if (!groupsRes.success) throw new Error(groupsRes.message);
      setPoles(polesRes.data);
      setGroups(groupsRes.data);
    } catch (e) {
      setLoadError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const groupNames = useMemo(() => groups.map((g) => g.group), [groups]);

  const filteredPoles = useMemo(() => {
    return poles.filter(
      (p) =>
        (filterGroup === "all" || p.group === filterGroup) &&
        (filterStatus === "all" || p.status === filterStatus)
    );
  }, [poles, filterGroup, filterStatus]);

  // chips สรุปตาม filter กลุ่มปัจจุบัน (สถานะนับจากเสาที่ผ่าน filter กลุ่ม)
  const summary = useMemo(() => {
    const inGroup = poles.filter((p) => filterGroup === "all" || p.group === filterGroup);
    const count = (status) => inGroup.filter((p) => p.status === status).length;
    return {
      total: inGroup.length,
      normal: count("normal"),
      damaged: count("damaged"),
      off: count("off"),
      unknown: count("unknown"),
    };
  }, [poles, filterGroup]);

  // แตะหมุด → โหลดข้อมูลเต็ม (รวมประวัติ) แล้วเปิด bottom-sheet
  const openPole = useCallback(async (pole) => {
    setSelectedPole(pole);
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`);
      const data = await res.json();
      if (data.success) setSelectedPole(data.data);
    } catch {
      // เน็ตหลุด/ตอบไม่เป็น JSON — คงข้อมูลย่อที่มีอยู่ใน sheet ไว้ (ประวัติจะว่าง)
    } finally {
      setSheetLoading(false);
    }
  }, []);

  const focusPole = useCallback(
    (pole) => {
      setFocusTarget({ lat: pole.lat, lng: pole.lng, zoom: 18, key: Date.now() });
      openPole(pole);
    },
    [openPole]
  );

  const refreshAndClose = useCallback(async () => {
    setSurveyPole(null);
    setEditPole(null);
    setSelectedPole(null);
    setRenameOpen(false);
    setAddFormOpen(false);
    setAddMode(false);
    setPickedLatLng(null);
    await loadAll();
  }, [loadAll]);

  // เพิ่มเสา: ใช้ GPS ปัจจุบันแทนการแตะแผนที่
  const pickCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์นี้ไม่รองรับ GPS — แตะเลือกจุดบนแผนที่แทน");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickedLatLng(ll);
        setFocusTarget({ ...ll, zoom: 18, key: Date.now() });
      },
      () => alert("อ่านตำแหน่งไม่ได้ — เปิดสิทธิ์ GPS หรือแตะเลือกจุดบนแผนที่แทน")
    );
  };

  return (
    <PermissionGuard>
      <main className="h-screen flex flex-col bg-gray-50">
        {/* แถบหัว + ค้นหา + กรอง */}
        <div className="bg-white border-b border-gray-200 p-3 space-y-2 z-10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="font-bold text-gray-900">💡 เสาไฟสาธารณะ (กองช่าง)</h1>
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setRenameOpen(true)}
              >
                🏘️ จัดการกลุ่ม
              </button>
              {addMode ? (
                <button
                  className="btn btn-sm btn-error"
                  onClick={() => {
                    setAddMode(false);
                    setPickedLatLng(null);
                  }}
                >
                  ✕ ยกเลิกเพิ่มเสา
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setAddMode(true);
                    setSelectedPole(null);
                  }}
                >
                  ➕ เพิ่มเสา
                </button>
              )}
            </div>
          </div>

          {addMode && (
            <div className="alert alert-info py-2 text-sm flex-wrap">
              <span>แตะจุดบนแผนที่เพื่อวางเสาใหม่ หรือ</span>
              <button className="btn btn-xs btn-outline" onClick={pickCurrentLocation}>
                📍 ใช้ตำแหน่งปัจจุบัน
              </button>
              {pickedLatLng && (
                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => setAddFormOpen(true)}
                >
                  ✓ ยืนยันตำแหน่งนี้ กรอกข้อมูล
                </button>
              )}
            </div>
          )}

          <SearchPanel poles={poles} onFocusPole={focusPole} />

          <div className="flex gap-2 items-center flex-wrap">
            <select
              className="select select-bordered select-sm"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="all">ทุกกลุ่ม ({poles.length})</option>
              {groups.map((g) => (
                <option key={g.group} value={g.group}>
                  {g.group} ({g.total})
                </option>
              ))}
            </select>

            {/* chips สรุป + กรองสถานะ (แตะเพื่อกรอง แตะซ้ำเพื่อยกเลิก) */}
            <button
              className={`badge badge-lg cursor-pointer ${filterStatus === "all" ? "badge-neutral" : "badge-ghost"}`}
              onClick={() => setFilterStatus("all")}
            >
              รวม {summary.total}
            </button>
            {Object.entries(POLE_STATUS).map(([value, s]) => (
              <button
                key={value}
                className="badge badge-lg cursor-pointer text-white border-0"
                style={{
                  backgroundColor: s.color,
                  opacity: filterStatus === "all" || filterStatus === value ? 1 : 0.35,
                }}
                onClick={() => setFilterStatus(filterStatus === value ? "all" : value)}
              >
                {s.label} {summary[value]}
              </button>
            ))}
          </div>

          {loadError && (
            <div className="alert alert-error py-2 text-sm">
              {loadError}
              <button className="btn btn-xs" onClick={loadAll}>ลองใหม่</button>
            </div>
          )}
        </div>

        {/* แผนที่เต็มพื้นที่ที่เหลือ */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              กำลังโหลดข้อมูลเสาไฟ…
            </div>
          ) : (
            <SmartLightMap
              poles={filteredPoles}
              groups={groups.filter(
                (g) => filterGroup === "all" || g.group === filterGroup
              )}
              focusTarget={focusTarget}
              selectedPoleId={selectedPole?._id || null}
              addMode={addMode}
              pickedLatLng={pickedLatLng}
              onPickLocation={setPickedLatLng}
              onSelectPole={openPole}
            />
          )}
        </div>

        {/* modals */}
        {selectedPole && !surveyPole && !editPole && (
          <PoleBottomSheet
            pole={selectedPole}
            loading={sheetLoading}
            onClose={() => setSelectedPole(null)}
            onSurvey={(p) => setSurveyPole(p)}
            onEdit={(p) => setEditPole(p)}
          />
        )}
        {surveyPole && (
          <SurveyModal
            pole={surveyPole}
            onClose={() => setSurveyPole(null)}
            onSaved={refreshAndClose}
          />
        )}
        {editPole && (
          <EditPoleModal
            key={editPole._id}
            pole={editPole}
            groupNames={groupNames}
            onClose={() => setEditPole(null)}
            onSaved={refreshAndClose}
            onDeleted={refreshAndClose}
          />
        )}
        {addFormOpen && pickedLatLng && (
          <AddPoleModal
            latLng={pickedLatLng}
            groupNames={groupNames}
            onClose={() => setAddFormOpen(false)}
            onSaved={refreshAndClose}
          />
        )}
        {renameOpen && (
          <GroupRenameModal
            groups={groups}
            onClose={() => setRenameOpen(false)}
            onRenamed={refreshAndClose}
          />
        )}
      </main>
    </PermissionGuard>
  );
}
