import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/outline';
import TaskCard from '@/components/TaskCard';

interface Task {
  _id: string;
  title: string;
  description?: string;
  type: 'complaint' | 'feedback' | 'elderly_visit';
  status: 'pending' | 'overdue' | 'in_progress';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAt: Date;
  dueDate?: Date;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
  imageUrl?: string;
}

interface ProfileUserProps {
  user: User;
  compact?: boolean;
}

export const ProfileUser: React.FC<ProfileUserProps> = ({ user, compact = false }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch(`/api/tasks/pending?userId=${user._id}`);
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error('Error fetching user tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?._id) {
      fetchTasks();
    }
  }, [user?._id]);

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  };

  if (compact) {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-4">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={`${user.firstName} ${user.lastName}`}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-base-content/50" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {user.firstName} {user.lastName}
              </h3>
              {user.role && (
                <p className="text-xs text-base-content/60 capitalize">{user.role}</p>
              )}
            </div>
          </div>

          {/* Task Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-info/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-info">{stats.total}</div>
              <div className="text-xs text-base-content/60">ทั้งหมด</div>
            </div>
            <div className="bg-warning/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-warning">{stats.overdue}</div>
              <div className="text-xs text-base-content/60">เกินกำหนด</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="card bg-base-100 border border-base-300 shadow-md">
        <div className="card-body">
          <div className="flex items-start gap-4">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={`${user.firstName} ${user.lastName}`}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-base-300 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-base-content/50" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold">
                {user.firstName} {user.lastName}
              </h2>
              {user.email && (
                <p className="text-sm text-base-content/60">{user.email}</p>
              )}
              {user.role && (
                <div className="mt-2">
                  <span className="badge badge-outline capitalize">{user.role}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-100 rounded-lg border border-base-300">
          <div className="stat-title">ทั้งหมด</div>
          <div className="stat-value text-primary text-3xl">{stats.total}</div>
          <div className="stat-desc">งานคงค้าง</div>
        </div>
        <div className="stat bg-base-100 rounded-lg border border-base-300">
          <div className="stat-title">รอดำเนินการ</div>
          <div className="stat-value text-info text-3xl">{stats.pending}</div>
          <div className="stat-desc">pending tasks</div>
        </div>
        <div className="stat bg-base-100 rounded-lg border border-base-300">
          <div className="stat-title">กำลังดำเนินการ</div>
          <div className="stat-value text-warning text-3xl">{stats.inProgress}</div>
          <div className="stat-desc">in progress</div>
        </div>
        <div className="stat bg-base-100 rounded-lg border border-base-300">
          <div className="stat-title">เกินกำหนด</div>
          <div className="stat-value text-error text-3xl">{stats.overdue}</div>
          <div className="stat-desc">overdue tasks</div>
        </div>
      </div>

      {/* Pending Tasks */}
      <div>
        <h3 className="text-xl font-semibold mb-4">งานคงค้าง</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span>ไม่มีงานคงค้าง</span>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
            {tasks.length > 5 && (
              <div className="text-center text-sm text-base-content/60">
                และอื่น ๆ {tasks.length - 5} งาน
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileUser;
