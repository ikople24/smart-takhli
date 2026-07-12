// หน้าเสาไฟสาธารณะ (กองช่าง) — ดีไซน์ใหม่ธีมม่วง: แผนที่ + แถบขวาวิเคราะห์ + มือถือ responsive
import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import { SL, SL_FONT_HEAD, SL_FONT_BODY, SL_FONTS_HREF } from "@/lib/smart-light/theme";
import PoleBottomSheet from "@/components/smart-light/PoleBottomSheet";
import SurveyModal from "@/components/smart-light/SurveyModal";
import AddPoleModal from "@/components/smart-light/AddPoleModal";
import GroupRenameModal from "@/components/smart-light/GroupRenameModal";
import SearchPanel from "@/components/smart-light/SearchPanel";
import RightRail from "@/components/smart-light/RightRail";
import MapStatusChips from "@/components/smart-light/MapStatusChips";
import DataTableModal from "@/components/smart-light/DataTableModal";
import NearbyCard from "@/components/smart-light/NearbyCard";
import { MapLayerToggle } from "@/components/smart-light/MapLayerToggle";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const SmartLightMap = dynamic(() => import("@/components/smart-light/SmartLightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full" style={{ color: SL.muted }}>
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
  const [boundaries, setBoundaries] = useState([]);
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
  const [tableOpen, setTableOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState("street"); // แผนที่ถนน / ภาพถ่ายดาวเทียม

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

  // โหลดขอบเขตชุมชนครั้งเดียว (พื้นหลังแผนที่) — พังได้โดยไม่กระทบหน้า
  useEffect(() => {
    fetch("/api/geojson-features")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.features)) setBoundaries(d.features);
      })
      .catch(() => {});
  }, []);

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

  // เลือกกลุ่มจาก heatmap: toggle filter + บินไป centroid ของกลุ่ม
  const selectGroup = useCallback((name, centroid) => {
    setFilterGroup(name);
    if (name !== "all" && centroid) {
      setFocusTarget({ lat: centroid.lat, lng: centroid.lng, zoom: 15, key: Date.now() });
    }
  }, []);

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
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={SL_FONTS_HREF} />
      </Head>
      <main className="sl-root h-full flex flex-col" style={{ fontFamily: SL_FONT_BODY, background: SL.surface }}>
        {/* Header ม่วง */}
        <div style={{ background: SL.primary, color: "#fff", flex: "0 0 auto" }} className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", fontSize: 22 }}>💡</div>
          <div className="min-w-0">
            <div style={{ font: `700 18px ${SL_FONT_HEAD}` }}>เสาไฟสาธารณะ · กองช่าง</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.82)" }}>
              ทะเบียนเสาไฟ LED · {poles.length} ต้น · {filterGroup === "all" ? "ทุกกลุ่ม" : filterGroup}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="hidden md:block" style={{ width: 200 }}>
              <SearchPanel poles={poles} onFocusPole={focusPole} />
            </div>
            <button onClick={() => setTableOpen(true)} style={{ border: 0, cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", font: "600 13px 'IBM Plex Sans Thai'", padding: "10px 14px", borderRadius: 12 }}>📋 ตารางข้อมูล</button>
            <button onClick={() => setRenameOpen(true)} style={{ border: 0, cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", font: "600 13px 'IBM Plex Sans Thai'", padding: "10px 14px", borderRadius: 12 }}>🏘️ กลุ่ม</button>
            {addMode ? (
              <button onClick={() => { setAddMode(false); setPickedLatLng(null); }} style={{ border: 0, cursor: "pointer", background: "#DC2626", color: "#fff", font: "700 13px 'IBM Plex Sans Thai'", padding: "10px 16px", borderRadius: 12 }}>✕ ยกเลิก</button>
            ) : (
              <button onClick={() => { setAddMode(true); setSelectedPole(null); }} style={{ border: 0, cursor: "pointer", background: "#fff", color: SL.primaryDark, font: "700 13px 'IBM Plex Sans Thai'", padding: "10px 16px", borderRadius: 12 }}>➕ เพิ่มเสา</button>
            )}
          </div>
        </div>

        {/* add-mode banner */}
        {addMode && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-2 text-sm" style={{ background: SL.soft, color: SL.primaryDark, flex: "0 0 auto" }}>
            <span>แตะจุดบนแผนที่เพื่อวางเสาใหม่ หรือ</span>
            <button className="btn btn-xs" onClick={pickCurrentLocation}>📍 ใช้ตำแหน่งปัจจุบัน</button>
            {pickedLatLng && <button className="btn btn-xs btn-primary" onClick={() => setAddFormOpen(true)}>✓ ยืนยันตำแหน่งนี้</button>}
          </div>
        )}

        {loadError && (
          <div className="alert alert-error py-2 text-sm mx-4 my-2" style={{ flex: "0 0 auto" }}>
            {loadError}
            <button className="btn btn-xs" onClick={loadAll}>ลองใหม่</button>
          </div>
        )}

        {/* body: map + right rail */}
        <div className="flex-1 flex min-h-0">
          <div className="relative flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full" style={{ color: SL.muted }}>กำลังโหลดข้อมูลเสาไฟ…</div>
            ) : (
              <SmartLightMap
                poles={filteredPoles}
                boundaries={boundaries}
                groups={groups.filter((g) => filterGroup === "all" || g.group === filterGroup)}
                focusTarget={focusTarget}
                selectedPoleId={selectedPole?._id || null}
                addMode={addMode}
                pickedLatLng={pickedLatLng}
                onPickLocation={setPickedLatLng}
                onSelectPole={openPole}
                baseLayer={baseLayer}
              />
            )}

            {/* chips ลอยบนแผนที่ — มือถือชิดซ้ายเลื่อนแนวนอน / เดสก์ท็อปจัดกลาง */}
            <div className="absolute z-[8] left-3 right-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2" style={{ top: 14 }}>
              <MapStatusChips summary={summary} filterStatus={filterStatus} onFilter={setFilterStatus} />
            </div>

            {/* ปุ่มสลับชั้นแผนที่ — มุมขวาบน (มือถือขยับลงใต้แถบ chip กันทับ) */}
            {!loading && (
              <div className="absolute z-[8] right-3 top-[60px] lg:top-3">
                <MapLayerToggle value={baseLayer} onChange={setBaseLayer} />
              </div>
            )}

            {/* การ์ดเสาใกล้ตัว (มือถือเท่านั้น) */}
            {!loading && !selectedPole && (
              <div className="lg:hidden absolute z-[9]" style={{ left: 14, right: 14, bottom: 16 }}>
                <NearbyCard poles={poles} onSelect={focusPole} />
              </div>
            )}
          </div>

          {/* แถบขวา (เดสก์ท็อป) */}
          {!loading && (
            <div className="hidden lg:flex">
              <RightRail
                summary={summary}
                poles={poles}
                groups={groups}
                filterStatus={filterStatus}
                filterGroup={filterGroup}
                onFilterStatus={setFilterStatus}
                onSelectPole={focusPole}
                onSelectGroup={selectGroup}
              />
            </div>
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
        {surveyPole && <SurveyModal pole={surveyPole} onClose={() => setSurveyPole(null)} onSaved={refreshAndClose} />}
        {editPole && (
          <EditPoleModal key={editPole._id} pole={editPole} groupNames={groupNames} onClose={() => setEditPole(null)} onSaved={refreshAndClose} onDeleted={refreshAndClose} />
        )}
        {addFormOpen && pickedLatLng && (
          <AddPoleModal latLng={pickedLatLng} groupNames={groupNames} onClose={() => setAddFormOpen(false)} onSaved={refreshAndClose} />
        )}
        {renameOpen && <GroupRenameModal groups={groups} onClose={() => setRenameOpen(false)} onRenamed={refreshAndClose} />}
        {tableOpen && (
          <DataTableModal
            poles={poles}
            onClose={() => setTableOpen(false)}
            onSelectRow={(p) => { setTableOpen(false); focusPole(p); }}
          />
        )}
      </main>
    </PermissionGuard>
  );
}
