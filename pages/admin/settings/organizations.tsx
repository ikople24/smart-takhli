import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

interface Organization {
  _id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  active: boolean;
  createdAt: string;
}

const emptyForm = {
  name: '',
  description: '',
  address: '',
  phone: '',
  email: '',
  website: '',
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/organizations');
      const data = await res.json();
      if (data.success) {
        setOrganizations(data.data);
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
    fetchOrganizations();
  }, []);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    modalRef.current?.showModal();
  };

  const openEditModal = (org: Organization) => {
    setForm({
      name: org.name,
      description: org.description,
      address: org.address,
      phone: org.phone,
      email: org.email,
      website: org.website,
    });
    setEditingId(org._id);
    modalRef.current?.showModal();
  };

  const openDeleteModal = (org: Organization) => {
    setDeleteTarget(org);
    deleteModalRef.current?.showModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/organizations?id=${editingId}`
        : '/api/admin/organizations';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        modalRef.current?.close();
        fetchOrganizations();
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
      const res = await fetch(`/api/admin/organizations?id=${deleteTarget._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        deleteModalRef.current?.close();
        setDeleteTarget(null);
        fetchOrganizations();
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
        <title>ข้อมูลองค์กร</title>
      </Head>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ข้อมูลองค์กร</h1>
            <p className="text-base-content/60 text-sm mt-1">จัดการข้อมูลองค์กรและสำนักงาน</p>
          </div>
          <button className="btn btn-primary gap-2" onClick={openAddModal}>
            <span>+</span>
            เพิ่มองค์กร
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
        ) : organizations.length === 0 ? (
          /* Empty state */
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body items-center text-center py-16">
              <div className="text-6xl mb-4">🏛️</div>
              <h2 className="card-title text-base-content/60">ยังไม่มีข้อมูลองค์กร</h2>
              <p className="text-base-content/40 text-sm">คลิก &quot;เพิ่มองค์กร&quot; เพื่อเริ่มต้น</p>
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
                    <th>ชื่อองค์กร</th>
                    <th>เบอร์โทร</th>
                    <th>อีเมล</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org, idx) => (
                    <tr key={org._id}>
                      <td className="text-base-content/40">{idx + 1}</td>
                      <td>
                        <div className="font-medium">{org.name}</div>
                        {org.description && (
                          <div className="text-xs text-base-content/50 mt-0.5 truncate max-w-xs">{org.description}</div>
                        )}
                        {org.address && (
                          <div className="text-xs text-base-content/40 truncate max-w-xs">{org.address}</div>
                        )}
                      </td>
                      <td className="text-sm">{org.phone || '-'}</td>
                      <td className="text-sm">{org.email || '-'}</td>
                      <td>
                        <span className={`badge badge-sm ${org.active ? 'badge-success' : 'badge-ghost'}`}>
                          {org.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-outline btn-info"
                            onClick={() => openEditModal(org)}
                          >
                            แก้ไข
                          </button>
                          <button
                            className="btn btn-xs btn-outline btn-error"
                            onClick={() => openDeleteModal(org)}
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
      <dialog ref={modalRef} id="modal-org" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">
            {editingId ? 'แก้ไขข้อมูลองค์กร' : 'เพิ่มองค์กรใหม่'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">ชื่อองค์กร <span className="text-error">*</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="กรอกชื่อองค์กร"
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
                <span className="label-text font-medium">ที่อยู่</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="กรอกที่อยู่"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">เบอร์โทรศัพท์</span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered w-full"
                  placeholder="เช่น 056-400-000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">อีเมล</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  placeholder="example@domain.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">เว็บไซต์</span>
              </label>
              <input
                type="url"
                className="input input-bordered w-full"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
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
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มองค์กร'}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>ปิด</button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModalRef} id="modal-org-delete" className="modal modal-bottom sm:modal-middle">
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
