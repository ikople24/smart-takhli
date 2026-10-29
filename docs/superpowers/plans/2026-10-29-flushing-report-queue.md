# รายงานผู้บริหาร + คิวงานโบตะกอนประจำ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แท็บ "รายงานและคิวงาน" ในหน้าโบตะกอน (สรุปรายวัน/รายเดือนแยกทีม + คิวรอบ 5/15 วัน) และกล่อง "คิวทีมของฉัน" ในหน้าภาคสนาม

**Architecture:** logic ล้วนใน `lib/smart-papar/flushingSchedule.js` (คิว + สรุปตามทีม + validate ทีม) มีเทสต์ vitest; ทีมเก็บใน collection `smart_papar_flushing_teams` แล้ว resolve จาก `createdByName` ตอนอ่าน; API แอดมิน 3 ตัว + ภาคสนาม 1 ตัว ใช้ loader ฝั่ง server ร่วมกัน

**Tech Stack:** Next.js 15 Pages Router, Mongoose, vitest, Tailwind (โทเคน pp-*)

Spec: `docs/superpowers/specs/2026-10-29-flushing-report-queue-design.md`

---

## File map

| ไฟล์ | หน้าที่ |
|---|---|
| Create `lib/smart-papar/flushingSchedule.js` | `CYCLE_DAYS`, `DEFAULT_TEAMS`, `teamResolver`, `addDaysYmd`, `daysBetweenYmd`, `buildQueue`, `queueCounts`, `summarizeByTeam`, `dailyBreakdown`, `monthRange`, `validateTeamsInput` |
| Create `lib/smart-papar/__tests__/flushingSchedule.test.js` | เทสต์ทุกฟังก์ชันข้างบน |
| Create `models/smart-papar/FlushingTeam.js` | `{ key, label, members, order }` collection `smart_papar_flushing_teams` |
| Create `lib/smart-papar/loadFlushingData.js` | server: `loadTeams()` (สร้าง default ถ้าไม่มี), `loadQueue(today)` |
| Create `pages/api/smart-papar/flushing/report.js` | GET สรุปรายวัน/รายเดือน |
| Create `pages/api/smart-papar/flushing/queue.js` | GET คิวทั้งหมด (แอดมิน) |
| Create `pages/api/smart-papar/flushing/teams.js` | GET/PUT ทีม |
| Create `pages/api/smart-papar/field/queue.js` | GET คิวทีมของเครื่องภาคสนาม |
| Create `components/smart-papar/FlushingReport.js` | แท็บรายงาน + คิว |
| Create `components/smart-papar/FlushingTeamsModal.js` | modal จับคู่ชื่อ → ทีม |
| Modify `pages/admin/smart-papar/water-quality/flushing.jsx` | แท็บที่ 3 `?tab=report` |
| Modify `components/smart-papar/FlushingForm.js` | prop `initialFlushPointId` |
| Modify `pages/papar/flushing.jsx` | กล่อง "คิวทีมของฉัน" |
| Modify `docs/modules/smart-papar.md`, `CLAUDE.md` | เอกสาร |

## Tasks

- [ ] **Task 1: logic + tests** — เขียนเทสต์ `flushingSchedule.test.js` ก่อน (คิว: ใส→+15, ขุ่น→+5, obstacle/damaged→blocked, ไม่เคยโบ→never, bucket overdue/today/upcoming/later, ทีมจากคนโบล่าสุด, เรียงลำดับ; สรุป: นับครั้งรวม log ไม่ผูกหัว, หัวนับครั้งเดียวตามทีมของ log ล่าสุด, ใส/ขุ่นตามผลล่าสุด; รายวัน; validateTeamsInput: key ไม่รู้จัก/ชื่อซ้ำข้ามทีม/trim/dedupe) → `npx vitest run lib/smart-papar/__tests__/flushingSchedule.test.js` FAIL → เขียน lib → PASS → commit
- [ ] **Task 2: model + loader + API แอดมิน** — `FlushingTeam`, `loadFlushingData.js`, `report.js`, `queue.js`, `teams.js` (ทุกตัวผ่าน `requireSmartPaparAdmin`) → ทดสอบด้วยสคริปต์ dry อ่าน DB จริงผ่าน loader → commit
- [ ] **Task 3: API ภาคสนาม** — `field/queue.js` ใช้ `readFieldSession`, คืนเฉพาะ `pointId, code, name, roadName, dueYmd, daysLeft, bucket, lastResult` ของทีมตัวเองใน bucket overdue/today/upcoming → commit
- [ ] **Task 4: แท็บรายงาน (แอดมิน)** — `FlushingReport.js` + `FlushingTeamsModal.js` + เพิ่มแท็บ → ตรวจภาพด้วย worktree port 3200 + mock fetch → commit
- [ ] **Task 5: ภาคสนาม** — `initialFlushPointId` ใน FlushingForm + กล่องคิวใน `/papar/flushing` → commit
- [ ] **Task 6: เอกสาร + verify** — อัปเดต docs, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (ใน worktree ไม่ทับ dev ของ user) → commit
