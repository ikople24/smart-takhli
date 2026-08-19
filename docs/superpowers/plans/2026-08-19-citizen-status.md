# แผน implement เฟส 3: ติดตามสถานะโฉมใหม่ (`/preview/status`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลิสต์ติดตามสถานะรวมทุกสถานะ + จอรายละเอียดรายเรื่อง ตามแคนวาส — API/PDPA/ให้คะแนน ใช้ของเดิมทั้งหมด หน้าเก่าไม่แตะ

**Architecture:** `pages/preview/status/index.tsx` (ลิสต์+chips+โหลดเพิ่ม) และ `pages/preview/status/[id].tsx` (รายละเอียด) ใน CitizenShell · logic ล้วน `lib/citizen/status/progress.js` (map complaint+assignment → ขั้น 1-4) มีเทสต์ · การ์ด/timeline ใน `components/citizen/status/`

**Tech Stack:** ตามเฟสก่อน · `ReactCompareImage` (dependency เดิม) · `SatisfactionForm` เดิม

**Spec:** `docs/superpowers/specs/2026-08-19-citizen-status-design.md` · **ระวัง:** dev พอร์ต 3100 · เช็ค branch ก่อน commit · e2e อ่านข้อมูลจริงได้แต่**ห้ามเขียน** (ห้ามกดส่งคะแนนจริง)

### Task 1: `lib/citizen/status/progress.js` — statusProgress (TDD)

- [ ] เทสต์ `lib/citizen/__tests__/statusProgress.test.js`: ไม่มี assignment → step 1 · มี assignment ยังไม่เสร็จ → step 3 (label ดำเนินการแก้ไข) · status เสร็จสิ้น → step 4 (at = completedAt ?? updatedAt) · เสร็จสิ้นแต่ไม่มี assignment → step 4 · timeline(): คืน 4 แถว {key,label,at,reached,detail}
- [ ] implement: `statusProgress(complaint, assignment)` → `{step, label, at}` และ `statusTimeline(complaint, assignment)` → แถว 4 ขั้น (ขั้น 2 detail = ชื่อกอง/เจ้าหน้าที่ถ้ามี)
- [ ] ผ่าน → commit `feat(citizen): logic ขั้นความคืบหน้าเรื่องร้องเรียน`

### Task 2: ลิสต์ `/preview/status`

- [ ] `components/citizen/status/ComplaintCard.tsx` — ตามแคนวาส `:168-178`: ไอคอนหมวด 42px (Prob_pic; fallback ตัวอักษรแรก) · ชื่อ (problems[0] ?? category) · เลขเรื่อง mono 11px · ชิปสถานะ · progress 4 ท่อน (`statusProgress`) · "อัปเดตล่าสุด · <label> · <วันที่ไทย>" (client-only)
- [ ] `pages/preview/status/index.tsx` — หัว back+ชื่อ (แบบจอสถานะแคนวาส) · chips ทั้งหมด/กำลังดำเนินการ/เสร็จสิ้น (จำนวนจาก withCount) · `?filter=active|done` · fetch `/api/complaints` (limit 20 + ปุ่มดูเพิ่มเติม) + `POST /api/complaints/assignments/by-complaints` · การ์ดลิงก์ไป `[id]` · BottomNav แสดง (ไม่ hideNav)
- [ ] ตรวจตา (ข้อมูลจริง) + commit `feat(citizen): ลิสต์ติดตามสถานะโฉมใหม่`

### Task 3: รายละเอียด `/preview/status/[id]`

- [ ] `components/citizen/status/Timeline.tsx` (4 ขั้น จุดม่วง/เทา + เส้นเชื่อม + detail/เวลา) · `components/citizen/status/BeforeAfter.tsx` (ReactCompareImage เมื่อมีทั้ง images+solutionImages; ไม่งั้นแกลเลอรี tile)
- [ ] `pages/preview/status/[id].tsx` — fetch `/api/complaints?complaintId=<id>` + assignments · หัวเรื่อง+ชิป+ชุมชน+วันแจ้ง · timeline · ปัญหา chips · รายละเอียด · รูป · การ์ดเจ้าหน้าที่ (ชื่อ/ตำแหน่ง/กอง เท่าที่ API ให้) · ให้คะแนน: reuse `SatisfactionForm` + count (source=public, เพดาน 4 — เงื่อนไขเดียว CardOfficail) · ปุ่มล่าง ติดต่อ จนท. (`tel:`) + แชร์ (Web Share/copy) · ไม่พบ/เรื่องลับ → จอไม่พบ
- [ ] ตรวจตา (เรื่องจริงทั้งสองสถานะ) + commit `feat(citizen): จอรายละเอียดสถานะ`

### Task 4: เดินสาย + ปิดเฟส

- [ ] `BottomNav`: ซ้าย `/preview/status?filter=active` · ขวา `/preview/status?filter=done` · จอสำเร็จ wizard → `/preview/status`
- [ ] e2e: ลิสต์กรองถูก → กดการ์ด → detail ครบ → back · `npm test` + lint · screenshot เทียบแคนวาส
- [ ] commit `feat(citizen): เชื่อม Nav เข้าติดตามสถานะโฉมใหม่ + ปิดเฟส 3`
