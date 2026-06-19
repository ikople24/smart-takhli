import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

interface GeoJSONFeatureDoc {
  _id: string;
  name: string;
  featureType: string;
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
  color: string;
  active: boolean;
  createdAt: string;
}

interface FeatureFormData {
  name: string;
  featureType: string;
  color: string;
  properties: string; // JSON string
  active: boolean;
}

const FEATURE_TYPES = [
  { value: 'ward',         label: 'เขต / หมู่บ้าน (Ward)' },
  { value: 'subcircuit',   label: 'ตำบล (Subcircuit)' },
  { value: 'service-area', label: 'พื้นที่บริการ (Service Area)' },
  { value: 'zone',         label: 'โซน (Zone)' },
  { value: 'other',        label: 'อื่นๆ (Other)' },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const emptyForm: FeatureFormData = {
  name: '',
  featureType: 'other',
  color: '#3B82F6',
  properties: '{}',
  active: true,
};

// ─── Map component (SSR-safe) ─────────────────────────────────────────────────

const MapPreview = dynamic(() => import('@/components/GeoJSONMapPreview'), { ssr: false });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeoJSONMapPage() {
  const [features, setFeatures] = useState<GeoJSONFeatureDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FeatureFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeoJSONFeatureDoc | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const modalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/geojson-features');
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setFeatures(json.features);
    } catch (e: unknown) {
      setError((e as Error).message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeatures(); }, [fetchFeatures]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    modalRef.current?.showModal();
  };

  const openEditModal = (f: GeoJSONFeatureDoc) => {
    setEditingId(f._id);
    setForm({
      name: f.name,
      featureType: f.featureType,
      color: f.color || '#3B82F6',
      properties: JSON.stringify(f.properties || {}, null, 2),
      active: f.active,
    });
    modalRef.current?.showModal();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    let parsedProps: Record<string, unknown> = {};
    try { parsedProps = JSON.parse(form.properties || '{}'); } catch {
      setError('Properties ต้องเป็น JSON ที่ถูกต้อง');
      setSaving(false);
      return;
    }

    // When editing, geometry stays from existing; for new features without geometry,
    // we skip (requires file import or manual input)
    const existing = editingId ? features.find(f => f._id === editingId) : null;

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        featureType: form.featureType,
        color: form.color,
        properties: parsedProps,
        active: form.active,
      };

      if (editingId) {
        body.id = editingId;
        if (existing) body.geometry = existing.geometry; // preserve geometry on edit
      } else {
        // New feature without file import — use empty Point as placeholder
        body.geometry = { type: 'Point', coordinates: [100.4, 15.1] };
      }

      const res = await fetch('/api/admin/geojson-features', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      modalRef.current?.close();
      fetchFeatures();
    } catch (e: unknown) {
      setError((e as Error).message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/geojson-features?id=${deleteTarget._id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      deleteModalRef.current?.close();
      setDeleteTarget(null);
      if (selectedFeatureId === deleteTarget._id) setSelectedFeatureId(null);
      fetchFeatures();
    } catch (e: unknown) {
      setError((e as Error).message || 'ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // ─── GeoJSON File Import ──────────────────────────────────────────────────

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImporting(true);

    try {
      const text = await file.text();
      const geojson = JSON.parse(text);

      let featureList: Array<{ geometry: GeoJSONGeometry; properties: Record<string, unknown> }> = [];

      if (geojson.type === 'FeatureCollection') {
        featureList = geojson.features;
      } else if (geojson.type === 'Feature') {
        featureList = [geojson];
      } else if (geojson.type === 'GeometryCollection' || geojson.coordinates) {
        // raw geometry
        featureList = [{ geometry: geojson, properties: {} }];
      } else {
        throw new Error('รูปแบบ GeoJSON ไม่รองรับ (ต้องเป็น FeatureCollection, Feature หรือ Geometry)');
      }

      if (featureList.length === 0) throw new Error('ไม่พบ Feature ใน GeoJSON');

      // Batch import
      const results = await Promise.allSettled(
        featureList.map(async (feat, idx) => {
          const name = (feat.properties?.name || feat.properties?.NAME ||
            feat.properties?.nameth || feat.properties?.title ||
            `Feature ${idx + 1}`) as string;
          const res = await fetch('/api/admin/geojson-features', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: String(name),
              featureType: 'other',
              geometry: feat.geometry || feat,
              properties: feat.properties || {},
              color: '#3B82F6',
              active: true,
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
        })
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        setImportError(`นำเข้าสำเร็จ ${results.length - failed}/${results.length} features (${failed} รายการล้มเหลว)`);
      }
      fetchFeatures();
    } catch (e: unknown) {
      setImportError((e as Error).message || 'นำเข้าไม่สำเร็จ');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const activeFeatures = features.filter(f => f.active);
  const selectedFeature = features.find(f => f._id === selectedFeatureId) ?? null;

  return (
    <>
      <Head><title>แผนที่ GeoJSON | Smart Takhli Admin</title></Head>

      {/* ─── Wrapper — ใช้ calc แทน h-full เพราะ LayoutAdmin ใส่ overflow-auto ──── */}
      <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 230px)' }}>

        {/* ─── Header bar ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-500 truncate">
            GeoJSON · {features.length} features · app_id: <span className="font-mono">{process.env.NEXT_PUBLIC_APP_ID}</span>
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label
              htmlFor="geojson-file"
              className={`h-8 px-3 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer flex items-center gap-1 ${importing ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {importing ? '⏳ กำลังนำเข้า...' : '📂 นำเข้า GeoJSON'}
            </label>
            <input
              id="geojson-file"
              ref={fileRef}
              type="file"
              accept=".json,.geojson"
              className="hidden"
              onChange={handleFileImport}
            />
            <button
              onClick={openAddModal}
              className="h-8 px-3 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              + เพิ่มด้วยตนเอง
            </button>
          </div>
        </div>

        {/* ─── Errors ─────────────────────────────────────────────────── */}
        {(error || importError) && (
          <div className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-800">
            {error || importError}
          </div>
        )}

        {/* ─── Main: Map + List — flex-1 ใช้พื้นที่ที่เหลือทั้งหมด ──────── */}
        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

          {/* Map — flex-1 เต็มความสูง */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <MapPreview
              features={activeFeatures}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
            />
          </div>

          {/* Feature list panel */}
          <div className="w-full lg:w-72 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">

            {/* Panel header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">
                Features
                <span className="ml-1.5 text-xs font-normal text-gray-400">({features.length})</span>
                {features.length > 10 && (
                  <span className="ml-1.5 text-[10px] text-blue-500">↕ scroll</span>
                )}
              </p>
              <button
                onClick={fetchFeatures}
                disabled={loading}
                className="h-6 px-2 text-[11px] rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                รีเฟรช
              </button>
            </div>

            {/* Scrollable list — เต็มพื้นที่ที่เหลือ */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="p-6 text-center text-sm text-gray-400">กำลังโหลด...</div>
              ) : features.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 space-y-2">
                  <p className="text-3xl">🗺️</p>
                  <p>ยังไม่มีข้อมูล GeoJSON</p>
                  <p className="text-xs">นำเข้าไฟล์ .json/.geojson<br/>หรือเพิ่มด้วยตนเอง</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {features.map((f) => (
                    <li
                      key={f._id}
                      className={`group px-3 py-2.5 flex items-start gap-2 cursor-pointer hover:bg-gray-50 transition-colors ${selectedFeatureId === f._id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedFeatureId(f._id === selectedFeatureId ? null : f._id)}
                    >
                      <span
                        className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white shadow-sm"
                        style={{ backgroundColor: f.color || '#3B82F6' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate leading-tight ${!f.active ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {f.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {FEATURE_TYPES.find(t => t.value === f.featureType)?.label?.split(' ')[0] ?? f.featureType}
                          {' · '}{f.geometry?.type}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                           onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditModal(f)}
                          className="h-6 w-6 text-[10px] rounded border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
                          title="แก้ไข"
                        >✏️</button>
                        <button
                          onClick={() => { setDeleteTarget(f); deleteModalRef.current?.showModal(); }}
                          className="h-6 w-6 text-[10px] rounded border border-red-100 hover:bg-red-50 flex items-center justify-center"
                          title="ลบ"
                        >🗑️</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected feature info */}
            {selectedFeature && (
              <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 bg-blue-50/50 text-xs text-gray-600 space-y-0.5">
                <p className="font-semibold text-gray-800 truncate">{selectedFeature.name}</p>
                <p className="font-mono text-gray-500">{selectedFeature.geometry?.type}</p>
                {Object.keys(selectedFeature.properties || {}).length > 0 && (
                  <p className="truncate text-gray-400">{Object.keys(selectedFeature.properties).join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Add / Edit Modal ──────────────────────────────────────────────── */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-full max-w-md">
          <h3 className="font-bold text-lg mb-4">{editingId ? 'แก้ไข Feature' : 'เพิ่ม Feature ด้วยตนเอง'}</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="label text-sm font-medium text-gray-700 pb-1">ชื่อ Feature *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="เช่น หมู่ 1 ตำบลตาคลี"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="label text-sm font-medium text-gray-700 pb-1">ประเภท</label>
              <select
                value={form.featureType}
                onChange={e => setForm(f => ({ ...f, featureType: e.target.value }))}
                className="select select-bordered w-full"
              >
                {FEATURE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-sm font-medium text-gray-700 pb-1">สี</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full cursor-pointer border border-gray-200"
                  title="เลือกสีเอง"
                />
              </div>
            </div>

            <div>
              <label className="label text-sm font-medium text-gray-700 pb-1">Properties (JSON)</label>
              <textarea
                value={form.properties}
                onChange={e => setForm(f => ({ ...f, properties: e.target.value }))}
                rows={4}
                className="textarea textarea-bordered w-full font-mono text-xs"
                placeholder='{}'
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="active-toggle"
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="checkbox checkbox-sm"
              />
              <label htmlFor="active-toggle" className="text-sm text-gray-700">แสดงบนแผนที่ (Active)</label>
            </div>

            {!editingId && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                💡 Feature ที่เพิ่มด้วยตนเองจะมี Geometry เป็น Point ชั่วคราว (ละติจูด/ลองจิจูดกลาง) — ใช้ปุ่ม &ldquo;นำเข้า GeoJSON&rdquo; เพื่อกำหนด Polygon/Polyline ที่แม่นยำ
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="modal-action mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => modalRef.current?.close()}>ยกเลิก</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>ปิด</button></form>
      </dialog>

      {/* ─── Delete Confirm Modal ──────────────────────────────────────────── */}
      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-sm">
          <h3 className="font-bold text-lg">ลบ Feature</h3>
          <p className="py-3 text-sm text-gray-600">
            ยืนยันการลบ <span className="font-semibold">{deleteTarget?.name}</span>?<br />
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </p>
          <div className="modal-action">
            <button className="btn btn-ghost btn-sm" onClick={() => deleteModalRef.current?.close()}>ยกเลิก</button>
            <button className="btn btn-error btn-sm" onClick={handleDelete} disabled={saving}>
              {saving ? 'กำลังลบ...' : 'ลบ'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>ปิด</button></form>
      </dialog>
    </>
  );
}
