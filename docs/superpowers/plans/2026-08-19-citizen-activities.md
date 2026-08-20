# แผน implement เฟส 4: ข่าว & กิจกรรมโฉมใหม่ (`/preview/activities`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ฟีดข่าวกิจกรรม + รายละเอียด (`?activity=`) สไตล์ citizen — ข้อมูล/ตัวนับ views ใช้ของเดิม หน้าเก่าไม่แตะ

**Spec:** `docs/superpowers/specs/2026-08-19-citizen-activities-design.md` · **ระวัง:** dev พอร์ต 3100 · เช็ค branch ก่อน commit · e2e intercept `POST **/view` เสมอ

### Task 1: `lib/citizen/activities/phase.js` (TDD)

- [ ] เทสต์ `lib/citizen/__tests__/activityPhase.test.js`: now<start → upcoming "กำลังจะเริ่ม" · start≤now≤end → active "กำลังดำเนินการ" · now>end → ended "สิ้นสุดแล้ว" · ขอบเวลาเท่ากันเป๊ะ (now===start → active, now===end → active) · ทุก key มีสีครบ
- [ ] implement `activityPhase(activity, now)` — เกณฑ์ตรง getActivityStatus ของหน้าเดิม · commit `feat(citizen): logic ช่วงสถานะกิจกรรม`

### Task 2: หน้า `/preview/activities` (ฟีด + รายละเอียดในหน้าเดียว)

- [ ] `components/citizen/activities/ActivityCard.tsx` — การ์ดแถว: รูปย่อ 74px (fallback พื้นลาย) · ชื่อ 2 บรรทัด · วันที่ไทย (`formatThaiDate`) + `อ่าน N` · ชิปสถานะเล็ก (activityPhase) · เป็น `Link href="/preview/activities?activity=<id>"`
- [ ] `pages/preview/activities.tsx`:
  - fetch feed limit=50 ครั้งเดียว · chips กรองฝั่ง client (ทั้งหมด/upcoming/active/ended + จำนวน) · การ์ดเด่น = รายการแรกที่มีรูปในผลกรอง
  - มุมมองรายละเอียดเมื่อ `?activity=` ตรงกับรายการ: แกลเลอรีรูปแนวนอน · ชื่อ+ชิป (จุด pulse เมื่อ active) · ช่วงวันที่ไทย · ยอดอ่าน · คำอธิบาย pre-line · ปุ่มแชร์ · ยิง `POST /api/activities/<id>/view` ครั้งเดียวต่อการเปิด · back = router.replace ลบ query
  - skeleton + role=status ตามแบบเฟสก่อน · ไม่พบ id → จอไม่พบ + ปุ่มกลับฟีด · CitizenShell hideNav (จอรองตามแคนวาส)
- [ ] ตรวจตา (ฟีดจริง + กรอง + รายละเอียด) · commit `feat(citizen): หน้าข่าว & กิจกรรมโฉมใหม่`

### Task 3: เดินสาย + ปิดเฟส

- [ ] `NewsSection`: "ดูทั้งหมด ›" → `/preview/activities` · การ์ด → `/preview/activities?activity=<id>`
- [ ] e2e: หน้าแรก → ดูทั้งหมด → ฟีด → กดการ์ด → รายละเอียด (intercept /view) → back · `npm test` + lint · screenshot
- [ ] commit `feat(citizen): เชื่อมหน้าแรกเข้าข่าวกิจกรรมโฉมใหม่ — ปิดเฟส 4`
