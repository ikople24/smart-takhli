import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

interface Community {
  _id: string;
  name: string;
  description: string;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  createdAt: string;
}

const emptyForm = {
  name: '',
  description: '',
  population: '',
  latitude: '',
  longitude: '',
};

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Community | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  const fetchCommunities = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/communities');
      const data = await res.json();
      if (data.success) {
        setCommunities(data.data);
      } else {
        setError(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setError('ไม่สามารถดึงข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    modalRef.current?.showModal();
  };

  const openEditModal = (community: Community) => {
    setForm({
      name: community.name,
      description: community.description,
      population: community.population !== null ? String(community.population) : '',
      latitude: community.latitude !== null ? String(community.latitude) : '',
      longitude: community.longitude !== null ? String(community.longitude) : '',
    });
    setEditingId(community._id);
    modalRef.current?.showModal();
  };

  const openDeleteModal = (community: Community) => {
    setDeleteTarget(community);
    deleteModalRef.current?.showModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        population: form.population !== '' ? Number(form.population) : null,
        latitude: form.latitude !== '' ? Number(form.latitude) : null,
        longitude: form.longitude !== '' ? Number(form.longitude) : null,
      };
      const url = editingId
        ? `/api/admin/communities?id=${editingId}`
        : '/api/admin/communities';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        modalRef.current?.close();
        fetchCommunities();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/communities?id=${deleteTarget._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        deleteModalRef.current?.close();
        setDeleteTarget(null);
        fetchCommunities();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>ข้อมูลชุมชน</title>
      </Head>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ข้อมูลชุมชน</h1>
            <p className="text-base-content/60 text-sm mt-1">จัดการข้อมูลชุมชนในพื้นที่</p>
          </div>
          <button className="btn btn-primary gap-2" onClick={openAddModal}>
            <span>+</span>
            เพิ่มชุมชน
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : communities.length === 0 ? (
          /* Empty state */
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body items-center text-center py-16">
              <div className="text-6xl mb-4">🏘️</div>
              <h2 className="card-title text-base-content/60">ยังไม่มีข้อมูลชุมชน</h2>
              <p className="text-base-content/40 text-sm">คลิก &quot;เพิ่มชุมชน&quot; เพื่อเริ่มต้น</p>
            </div>
          </div>
        ) : (
          /* Table */
          <div className="card bg-base-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ชื่อชุมชน</th>
                    <th>จำนวนประชากร</th>
                    <th>พิกัด</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {communities.map((community, idx) => (
                    <tr key={community._id}>
                      <td className="text-base-content/40">{idx + 1}</td>
                      <td>
                        <div className="font-medium">{community.name}</div>
                        {community.description && (
                          <div className="text-xs text-base-content/50 mt-0.5 truncate max-w-xs">{community.description}</div>
                        )}
                      </td>
                      <td className="text-sm">
                        {community.population !== null
                          ? community.population.toLocaleString('th-TH') + ' คน'
                          : '-'}
                      </td>
                      <td className="text-sm">
                        {community.latitude !== null && community.longitude !== null ? (
                          <span className="font-mono text-xs">
                            {community.latitude.toFixed(4)}, {community.longitude.toFixed(4)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${community.active ? 'badge-success' : 'badge-ghost'}`}>
                          {community.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-outline btn-info"
                            onClick={() => openEditModal(community)}
                          >
                            แก้ไข
                          </button>
                          <button
                            className="btn btn-xs btn-outline btn-error"
                            onClick={() => openDeleteModal(community)}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <dialog ref={modalRef} id="modal-community" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">
            {editingId ? 'แก้ไขข้อมูลชุมชน' : 'เพิ่มชุมชนใหม่'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">ชื่อชุมชน <span className="text-error">*</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="กรอกชื่อชุมชน"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">คำอธิบาย</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="กรอกคำอธิบาย"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">จำนวนประชากร (คน)</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="เช่น 1500"
                min={0}
                value={form.population}
                onChange={(e) => setForm({ ...form, population: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">ละติจูด (Latitude)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered w-full"
                  placeholder="เช่น 15.2640"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">ลองจิจูด (Longitude)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered w-full"
                  placeholder="เช่น 100.3430"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => modalRef.current?.close()}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-sm"></span> : null}
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มชุมชน'}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>ปิด</button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModalRef} id="modal-community-delete" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg text-error mb-2">ยืนยันการลบ</h3>
          <p className="text-base-content/70">
            คุณต้องการลบ <span className="font-semibold text-base-content">&ldquo;{deleteTarget?.name}&rdquo;</span> ใช่หรือไม่?
          </p>
          <p className="text-sm text-error/70 mt-1">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
          <div className="modal-action">
            <button
              className="btn btn-ghost"
              onClick={() => {
                deleteModalRef.current?.close();
                setDeleteTarget(null);
              }}
            >
              ยกเลิก
            </button>
            <button className="btn btn-error" onClick={handleDelete} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm"></span> : null}
              ลบข้อมูล
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>ปิด</button>
        </form>
      </dialog>
    </>
  );
}
