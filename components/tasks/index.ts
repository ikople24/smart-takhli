// components/tasks — shared components ของหน้าจัดการงานเจ้าหน้าที่ (README § ลำดับงาน ข้อ 4)
// ใช้โทเคน tk-* (styles/globals.css) และ logic จาก lib/tasks/* — ห้ามคำนวณ derived fields ในนี้
export { AlertBadge, TONE_CLASSES, TONE_DOT_CLASSES, SEVERITY_TONE } from './AlertBadge';
export type { AlertBadgeProps } from './AlertBadge';
export { TaskRow, SEVERITY_BAR_CLASSES } from './TaskRow';
export type { TaskRowProps } from './TaskRow';
export { WorkGroupAccordion, tileForGroup } from './WorkGroupAccordion';
export type { WorkGroupAccordionProps } from './WorkGroupAccordion';
export { PoolCard } from './PoolCard';
export type { PoolCardProps, PoolAction } from './PoolCard';
export { StatusStepper } from './StatusStepper';
export type { StatusStepperProps } from './StatusStepper';
export { CoordinationBlock } from './CoordinationBlock';
export type { CoordinationBlockProps } from './CoordinationBlock';
