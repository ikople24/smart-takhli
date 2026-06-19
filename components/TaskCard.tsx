import React from 'react';
import { Badge } from '@/components/ui';
import { ArrowRightIcon, ClockIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface TaskItem {
  _id: string;
  title: string;
  description?: string;
  type: 'complaint' | 'feedback';
  status: 'pending' | 'overdue' | 'in_progress';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAt: Date;
  dueDate?: Date;
  actionUrl?: string;
  metadata?: {
    complaintId?: string;
  };
}

interface TaskCardProps {
  task: TaskItem;
  onAction?: (url?: string) => void;
  onComplete?: (id: string) => void;
}

const statusVariants: Record<'pending' | 'overdue' | 'in_progress', 'accent' | 'error' | 'warning'> = {
  pending: 'accent',
  overdue: 'error',
  in_progress: 'warning',
};

const priorityVariants: Record<'low' | 'medium' | 'high' | 'urgent', 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const typeLabels = {
  complaint: 'ร้องเรียน',
  feedback: 'ความพึงพอใจ',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onAction, onComplete }) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="p-4 rounded-lg border border-base-300 bg-base-100 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Priority indicator */}
        <div
          className={`flex-shrink-0 w-1 h-12 rounded-full ${
            task.priority === 'urgent'
              ? 'bg-error'
              : task.priority === 'high'
              ? 'bg-warning'
              : task.priority === 'medium'
              ? 'bg-info'
              : 'bg-neutral'
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-base text-base-content">
              {task.title}
            </h3>
            <Badge variant={priorityVariants[task.priority]} size="sm">
              {task.priority}
            </Badge>
            <Badge variant={statusVariants[task.status]} size="sm">
              {task.status === 'pending' && 'รอดำเนิน'}
              {task.status === 'in_progress' && 'กำลังดำเนิน'}
              {task.status === 'overdue' && 'เกินกำหนด'}
            </Badge>
          </div>

          {task.description && (
            <p className="text-sm text-base-content/70 mb-2 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-base-content/50 flex-wrap">
            <span className="badge badge-ghost badge-sm">
              {typeLabels[task.type]}
            </span>
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <ClockIcon className={`w-3 h-3 ${isOverdue ? 'text-error' : ''}`} />
                <span className={isOverdue ? 'text-error font-medium' : ''}>
                  {new Date(task.dueDate).toLocaleDateString('th-TH')}
                </span>
              </div>
            )}
            <span>
              {new Date(task.assignedAt).toLocaleDateString('th-TH')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-2">
          {onAction && (
            <button
              onClick={() => onAction(task.actionUrl)}
              className="btn btn-ghost btn-sm btn-circle tooltip"
              data-tip="ดูรายละเอียด"
            >
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          {onComplete && (
            <button
              onClick={() => onComplete(task._id)}
              className="btn btn-ghost btn-sm btn-circle text-success tooltip"
              data-tip="ทำเครื่องหมายว่าเสร็จสิ้น"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
