// /admin/superadmin/audit-log — หน้า Audit Log สำหรับ superadmin
// Phase 2: Advanced permissions & audit logging

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import {
  ClockIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface AuditLog {
  _id: string;
  actorClerkId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, string> = {
  complaint_status_changed: 'เปลี่ยนสถานะเรื่องร้องเรียน',
  complaint_assigned: 'มอบหมายงาน',
  complaint_completed: 'งานเสร็จสิ้น',
  permissions_updated: 'อัปเดตสิทธิ์',
  app_id_assigned: 'กำหนด App ID',
  assignment_created: 'สร้างการมอบหมาย',
  assignment_completed: 'งานเสร็จสิ้น',
  notification_sent: 'ส่งการแจ้งเตือน',
  data_exported: 'ส่งออกข้อมูล',
  login: 'เข้าสู่ระบบ',
};

const ACTION_COLORS: Record<string, string> = {
  complaint_status_changed: 'badge-info',
  complaint_assigned: 'badge-primary',
  complaint_completed: 'badge-success',
  permissions_updated: 'badge-warning',
  app_id_assigned: 'badge-warning',
  assignment_created: 'badge-primary',
  assignment_completed: 'badge-success',
  notification_sent: 'badge-ghost',
  data_exported: 'badge-neutral',
  login: 'badge-ghost',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export default function AuditLogPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const isSuperAdmin = isLoaded && user?.publicMetadata?.role === 'superadmin';

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) {
      router.replace('/admin');
    }
  }, [isLoaded, isSuperAdmin, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (filterAction) params.set('action', filterAction);
    if (filterActor) params.set('actor', filterActor);

    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterActor]);

  useEffect(() => {
    if (isSuperAdmin) fetchLogs();
  }, [isSuperAdmin, fetchLogs]);

  if (!isLoaded || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Audit Log</h1>
            <p className="text-purple-200">ประวัติการเปลี่ยนแปลงข้อมูลสำคัญในระบบ</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-white/70 text-xs mb-1 block">กรองตาม Action</label>
              <select
                className="select select-sm w-full bg-white/10 border-white/20 text-white"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              >
                <option value="" className="text-black">ทุก Action</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="text-black">{v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-white/70 text-xs mb-1 block">ค้นหาชื่อผู้กระทำ</label>
              <input
                type="text"
                placeholder="ค้นหาชื่อ..."
                className="input input-sm w-full bg-white/10 border-white/20 text-white placeholder-white/40"
                value={filterActor}
                onChange={(e) => { setFilterActor(e.target.value); setPage(1); }}
              />
            </div>
            <button
              onClick={fetchLogs}
              className="btn btn-sm btn-outline border-white/30 text-white hover:bg-white/10"
            >
              <ArrowPathIcon className="w-4 h-4 mr-1" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Stats */}
        {pagination && (
          <p className="text-purple-200 text-sm mb-4">
            พบ {pagination.total.toLocaleString()} รายการ
            • หน้า {pagination.page}/{pagination.totalPages}
          </p>
        )}

        {/* Log Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-purple-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <ShieldCheckIcon className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="text-xl">ยังไม่มี Audit Log</p>
            <p className="text-sm mt-2">Log จะปรากฏเมื่อมีการเปลี่ยนแปลงข้อมูลในระบบ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log._id}
                className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden"
              >
                <div
                  className="p-4 flex items-start gap-4 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                >
                  {/* Icon */}
                  <div className="mt-0.5 w-8 h-8 flex-shrink-0 bg-white/10 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-purple-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className={`badge badge-sm ${ACTION_COLORS[log.action] || 'badge-ghost'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-white/50 text-xs">
                        {log.resourceType}
                        {log.resourceId ? ` · ${log.resourceId.slice(-8)}` : ''}
                      </span>
                    </div>
                    <p className="text-white text-sm font-medium">{log.description}</p>
                    <p className="text-white/50 text-xs mt-1">
                      โดย <span className="text-purple-300">{log.actorName || log.actorClerkId}</span>
                      {' · '}
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === log._id && (log.before || log.after || log.meta) && (
                  <div className="border-t border-white/10 p-4 bg-black/20">
                    {log.before != null && (
                      <div className="mb-3">
                        <p className="text-white/50 text-xs mb-1">ก่อน</p>
                        <pre className="text-green-300 text-xs bg-black/30 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(log.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.after != null && (
                      <div className="mb-3">
                        <p className="text-white/50 text-xs mb-1">หลัง</p>
                        <pre className="text-blue-300 text-xs bg-black/30 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.meta && (
                      <div>
                        <p className="text-white/50 text-xs mb-1">Metadata</p>
                        <pre className="text-gray-300 text-xs bg-black/30 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-sm btn-outline border-white/30 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-white/70 text-sm">
              {page} / {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-sm btn-outline border-white/30 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
