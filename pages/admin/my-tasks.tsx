import React, { useEffect, useState } from 'react';
import { LayoutAdmin } from '@/components/LayoutAdmin';
import { TaskCard, TaskItem } from '@/components/TaskCard';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { Badge, Button, Card } from '@/components/ui';
import {
  FunnelIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type FilterType = 'all' | 'complaint' | 'feedback' | 'elderly_visit';
type StatusFilter = 'all' | 'pending' | 'overdue' | 'in_progress';

export default function MyTasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
  };

  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      try {
        const response = await axios.get('/api/tasks/pending', {
          headers: { 'x-app-id': process.env.NEXT_PUBLIC_APP_ID },
        });
        setTasks(response.data.tasks || []);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user]);

  // Apply filters
  useEffect(() => {
    let filtered = [...tasks];

    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    setFilteredTasks(filtered);
  }, [tasks, filterType, filterStatus]);

  const handleComplete = async (id: string) => {
    if (id.startsWith('feedback-') || id.startsWith('elderly-')) {
      console.log('Manual task completion:', id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      return;
    }

    try {
      await axios.put(
        `/api/assignments/${id}/complete`,
        {},
        {
          headers: { 'x-app-id': process.env.NEXT_PUBLIC_APP_ID },
        }
      );
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleNavigate = (url?: string) => {
    if (url) window.location.href = url;
  };

  return (
    <LayoutAdmin
      title="งานของฉัน"
      subtitle="ดูและจัดการงานที่รอการดำเนินการ"
      breadcrumbs={[
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'งานของฉัน' },
      ]}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-base-content/60">รวมทั้งหมด</p>
                <p className="text-3xl font-bold text-base-content">
                  {stats.total}
                </p>
              </div>
              <div className="text-accent text-4xl">📋</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-base-content/60">รอดำเนิน</p>
                <p className="text-3xl font-bold text-info">{stats.pending}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-info" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-base-content/60">เกินกำหนด</p>
                <p className="text-3xl font-bold text-error">{stats.overdue}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-error" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-base-content/60">กำลังดำเนิน</p>
                <p className="text-3xl font-bold text-warning">
                  {stats.inProgress}
                </p>
              </div>
              <div className="text-warning text-4xl">⚙️</div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <FunnelIcon className="w-5 h-5 text-base-content/60" />
            <h3 className="font-semibold">ตัวกรอง</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Type Filter */}
            <div>
              <label className="text-xs font-semibold text-base-content/60 mb-2 block">
                ประเภทงาน
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="select select-bordered select-sm w-full"
              >
                <option value="all">ทั้งหมด</option>
                <option value="complaint">ร้องเรียน</option>
                <option value="feedback">ความพึงพอใจ</option>
                <option value="elderly_visit">เยี่ยมผู้สูงอายุ</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-semibold text-base-content/60 mb-2 block">
                สถานะ
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                className="select select-bordered select-sm w-full"
              >
                <option value="all">ทั้งหมด</option>
                <option value="pending">รอดำเนิน</option>
                <option value="overdue">เกินกำหนด</option>
                <option value="in_progress">กำลังดำเนิน</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-base-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              {stats.total === 0 ? (
                <>
                  <CheckCircleIcon className="w-16 h-16 text-success mx-auto mb-4" />
                  <p className="text-lg font-semibold text-base-content mb-2">
                    ยินดีด้วย!
                  </p>
                  <p className="text-base-content/60">
                    ไม่มีงานรออยู่ในขณะนี้
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-base-content mb-2">
                    ไม่พบงานที่ตรงกับตัวกรอง
                  </p>
                  <p className="text-base-content/60 mb-4">
                    ลองเปลี่ยนตัวกรองเพื่อดูงานอื่นๆ
                  </p>
                  <Button
                    onClick={() => {
                      setFilterType('all');
                      setFilterStatus('all');
                    }}
                  >
                    รีเซ็ตตัวกรอง
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onAction={() => handleNavigate(task.actionUrl)}
                onComplete={() => handleComplete(task._id)}
              />
            ))}
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
}
