import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import { TaskCard, TaskItem } from '@/components/TaskCard';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { CheckCircleIcon, ExclamationTriangleIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface TaskStats {
  total: number;
  overdue: number;
  pending: number;
}

export const PendingTasksWidget: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, overdue: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      try {
        const response = await axios.get('/api/tasks/pending', {
          headers: { 'x-app-id': process.env.NEXT_PUBLIC_APP_ID },
        });

        const allTasks = response.data.tasks || [];
        setTasks(allTasks);

        const overdue = allTasks.filter(
          (t: TaskItem) => t.status === 'overdue'
        ).length;
        const pending = allTasks.filter(
          (t: TaskItem) => t.status === 'pending'
        ).length;

        setStats({
          total: allTasks.length,
          overdue,
          pending,
        });
      } catch (error) {
        console.error('Failed to fetch pending tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user]);

  const displayTasks = minimal ? tasks.slice(0, 3) : tasks;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-base-content/60">รวมงานทั้งหมด</p>
              <p className="text-2xl font-bold text-base-content">{stats.total}</p>
            </div>
            <ListBulletIcon className="w-8 h-8 text-accent" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-base-content/60">รอดำเนิน</p>
              <p className="text-2xl font-bold text-info">{stats.pending}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-info" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-base-content/60">เกินกำหนด</p>
              <p className="text-2xl font-bold text-error">{stats.overdue}</p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-error" />
          </div>
        </Card>
      </div>

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
      ) : tasks.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <CheckCircleIcon className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="text-base-content/60 text-lg">ยินดีด้วย! ไม่มีงานรออยู่</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onAction={(url) => {
                if (url) window.location.href = url;
              }}
            />
          ))}
        </div>
      )}

      {/* View All Link */}
      {minimal && tasks.length > 3 && (
        <Link
          href="/admin/my-tasks"
          className="btn btn-outline btn-block btn-sm gap-2"
        >
          ดูงานทั้งหมด ({tasks.length})
        </Link>
      )}
    </div>
  );
};
