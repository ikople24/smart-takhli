import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type StatusFilter = 'all' | 'pending' | 'overdue' | 'completed';

interface KPI {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  avgResolutionDays: number | null;
}

interface Assignment {
  _id: string;
  complaintId: string | null;
  title: string;
  description?: string;
  category?: string;
  status: 'pending' | 'overdue' | 'completed';
  assignedAt: string;
  completedAt?: string | null;
  daysAssigned: number;
  resolutionDays: number | null;
  actionUrl: string | null;
}

const statusLabel: Record<StatusFilter, string> = {
  all: 'ทั้งหมด',
  pending: 'รอดำเนิน',
  overdue: 'เกินกำหนด',
  completed: 'เสร็จสิ้น',
};

const statusStyle: Record<Assignment['status'], string> = {
  pending: 'badge-info',
  overdue: 'badge-error',
  completed: 'badge-success',
};

export default function MyTasksPage() {
  const { user } = useUser();
  const router = useRouter();

  const [kpi, setKpi] = useState<KPI | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data } = await axios.get('/api/tasks/my-kpi');
        setKpi(data.kpi);
        setAssignments(data.assignments || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const filtered =
    statusFilter === 'all'
      ? assignments
      : assignments.filter((a) => a.status === statusFilter);

  return (
      <div className="max-w-5xl mx-auto space-y-6">

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-base-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : kpi ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="col-span-1 bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col items-center text-center">
              <ClipboardDocumentListIcon className="w-7 h-7 text-primary mb-1" />
              <p className="text-2xl font-bold text-primary">{kpi.total}</p>
              <p className="text-xs text-base-content/60 mt-1">รับทั้งหมด</p>
            </div>

            <div className="col-span-1 bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col items-center text-center">
              <CheckCircleIcon className="w-7 h-7 text-success mb-1" />
              <p className="text-2xl font-bold text-success">{kpi.completed}</p>
              <p className="text-xs text-base-content/60 mt-1">เสร็จสิ้น</p>
            </div>

            <div className="col-span-1 bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col items-center text-center">
              <ClockIcon className="w-7 h-7 text-info mb-1" />
              <p className="text-2xl font-bold text-info">{kpi.pending}</p>
              <p className="text-xs text-base-content/60 mt-1">รอดำเนิน</p>
            </div>

            <div className="col-span-1 bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col items-center text-center">
              <ExclamationTriangleIcon className="w-7 h-7 text-error mb-1" />
              <p className="text-2xl font-bold text-error">{kpi.overdue}</p>
              <p className="text-xs text-base-content/60 mt-1">เกินกำหนด</p>
            </div>

            <div className="col-span-1 bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col items-center text-center">
              <ChartBarIcon className="w-7 h-7 text-primary mb-1" />
              <p className="text-2xl font-bold text-primary">{kpi.completionRate}%</p>
              <p className="text-xs text-base-content/60 mt-1">อัตราเสร็จ</p>
            </div>

            <div className="col-span-1 bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col items-center text-center">
              <ClockIcon className="w-7 h-7 text-accent mb-1" />
              <p className="text-2xl font-bold text-accent">
                {kpi.avgResolutionDays !== null ? `${kpi.avgResolutionDays}` : '-'}
              </p>
              <p className="text-xs text-base-content/60 mt-1">เฉลี่ย (วัน)</p>
            </div>
          </div>
        ) : null}

        {/* Status Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'overdue', 'completed'] as StatusFilter[]).map((s) => {
            const count =
              s === 'all'
                ? assignments.length
                : assignments.filter((a) => a.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`btn btn-sm rounded-full ${
                  statusFilter === s ? 'btn-primary' : 'btn-ghost border border-base-300'
                }`}
              >
                {statusLabel[s]}
                <span className="badge badge-sm ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Assignment List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-base-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-base-200 rounded-xl">
            <CheckCircleIcon className="w-14 h-14 text-success mx-auto mb-3" />
            <p className="font-semibold text-lg">
              {statusFilter === 'all' ? 'ยังไม่มีงานที่ได้รับมอบหมาย' : 'ไม่มีงานในหมวดนี้'}
            </p>
            <p className="text-sm text-base-content/50 mt-1">
              งานร้องเรียนที่ได้รับมอบหมายจาก หน้าจัดการร้องเรียนจะแสดงที่นี่
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <div
                key={a._id}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl border bg-base-100 ${
                  a.status === 'overdue' ? 'border-error/30' : 'border-base-300'
                }`}
              >
                {/* Left bar */}
                <div
                  className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    a.status === 'overdue'
                      ? 'bg-error'
                      : a.status === 'completed'
                      ? 'bg-success'
                      : 'bg-info'
                  }`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-sm">{a.title}</span>
                    <span className={`badge badge-sm ${statusStyle[a.status]}`}>
                      {statusLabel[a.status]}
                    </span>
                    {a.category && (
                      <span className="badge badge-ghost badge-sm">{a.category}</span>
                    )}
                  </div>
                  {a.description && (
                    <p className="text-xs text-base-content/60 line-clamp-1">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-base-content/50 mt-1 flex-wrap">
                    <span>รับเมื่อ {new Date(a.assignedAt).toLocaleDateString('th-TH')}</span>
                    {a.completedAt && (
                      <span className="text-success">
                        เสร็จ {new Date(a.completedAt).toLocaleDateString('th-TH')}
                        {a.resolutionDays !== null && ` (${a.resolutionDays} วัน)`}
                      </span>
                    )}
                    {a.status === 'overdue' && (
                      <span className="text-error font-medium">
                        เกิน {a.daysAssigned - 7} วัน
                      </span>
                    )}
                  </div>
                </div>

                {/* Action button — only for non-completed */}
                {a.status !== 'completed' && a.actionUrl && (
                  <button
                    onClick={() => router.push(a.actionUrl!)}
                    className="btn btn-ghost btn-sm btn-circle tooltip flex-shrink-0"
                    data-tip="ดูรายละเอียด"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
