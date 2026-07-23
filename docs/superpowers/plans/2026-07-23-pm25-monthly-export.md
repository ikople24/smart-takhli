# PM2.5 Monthly Report CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม Export CSV รายงานค่าเฉลี่ย PM2.5 รายเดือนบนหน้า `/admin/pm25-settings` โดยดึงข้อมูลจาก collection `pm25_monthly` ใน MongoDB

**Architecture:** API endpoint ใหม่ (`GET /api/pm25/monthly-report`, ป้องกันด้วย `requirePm25Admin`) ส่ง JSON ทุกเดือนจาก model `Pm25Monthly` → component ฝั่ง client (`components/pm25/ExportPm25Monthly.jsx`) แปลงเป็น CSV UTF-8+BOM แล้ว trigger download ตาม pattern `components/complaints/ExportComplaints.js` → วางปุ่มเป็น card ใหม่ในหน้า settings เดิม (ไม่มีหน้า admin ใหม่ ไม่ต้องแก้สิทธิ์)

**Tech Stack:** Next.js 15 Pages Router, Mongoose (`Pm25Monthly`), Clerk (`useAuth().getToken` + `requirePm25Admin`), SweetAlert2, DaisyUI, lucide-react

**Spec:** `docs/superpowers/specs/2026-07-23-pm25-monthly-export-design.md`

**หมายเหตุการทดสอบ:** repo นี้**ไม่มี test runner** (ยืนยันใน CLAUDE.md) — แต่ละ task ตรวจด้วย `npm run lint` + ตรวจพฤติกรรมจริงผ่าน dev server/curl แทน unit test

**Branch:** ทำงานบน `pm25-monthly-report-export` (แตกจาก `origin/main` แล้ว — spec commit `c5e785a` อยู่บนนี้)

---

### Task 1: API endpoint `GET /api/pm25/monthly-report`

**Files:**
- Create: `pages/api/pm25/monthly-report.js`

- [ ] **Step 1: สร้างไฟล์ API handler**

สร้าง `pages/api/pm25/monthly-report.js` เนื้อหาทั้งไฟล์:

```js
import dbConnect from "@/lib/dbConnect";
import Pm25Monthly from "@/models/Pm25Monthly";
import { requirePm25Admin } from "@/pages/api/pm25/_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = await requirePm25Admin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    await dbConnect();
    const months = await Pm25Monthly.find()
      .sort({ year: 1, month: 1 })
      .select("monthKey month year name fullName avg count syncedAt -_id")
      .lean();
    return res.status(200).json({ success: true, months });
  } catch (error) {
    console.error("pm25 monthly-report GET error:", error);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
```

เหตุผลเชิงโครงสร้าง (ตรงกับ pattern เดิมใน `pages/api/pm25/settings.js`):
- เช็ค method ก่อน auth → POST/PUT ตอบ 405 ได้โดยไม่ต้อง auth
- `requirePm25Admin` มาจาก `pages/api/pm25/_auth.js` คืน `{ ok, status, message }` เมื่อไม่ผ่าน
- `.select("... -_id")` ตัด `_id` ออก เพราะ client ไม่ใช้
- เรียง `year: 1, month: 1` = เก่า → ใหม่ ตาม spec

- [ ] **Step 2: ตรวจ lint**

Run: `npm run lint`
Expected: ผ่าน ไม่มี error ใหม่ (warning เดิมของ repo ถ้ามี ไม่นับ)

- [ ] **Step 3: ตรวจ auth gate + method gate ด้วย dev server**

รัน dev server ชั่วคราวแล้ว curl (ไม่มี token):

```bash
npm run dev &
DEV_PID=$!
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/pm25/monthly-report
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/pm25/monthly-report
kill $DEV_PID
```

Expected: บรรทัดแรก `401` (GET ไม่มี token) บรรทัดสอง `405` (POST)
หมายเหตุ: ถ้า port 3000 ถูกใช้อยู่ Next จะขยับ port เอง — ดู URL จาก output ของ `npm run dev` แล้วปรับ curl ตาม

- [ ] **Step 4: Commit**

```bash
git add pages/api/pm25/monthly-report.js
git commit -m "feat(pm25): API รายงานรายเดือนจาก Pm25Monthly สำหรับ export CSV

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Component ปุ่ม Export `components/pm25/ExportPm25Monthly.jsx`

**Files:**
- Create: `components/pm25/ExportPm25Monthly.jsx` (เริ่มโฟลเดอร์ `components/pm25/` ตาม module convention)

- [ ] **Step 1: สร้าง component**

สร้าง `components/pm25/ExportPm25Monthly.jsx` เนื้อหาทั้งไฟล์:

```jsx
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Swal from "sweetalert2";
import { Download } from "lucide-react";

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatSyncedAt(syncedAt) {
  if (!syncedAt) return "";
  return new Date(syncedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function ExportPm25Monthly() {
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/pm25/monthly-report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");

      if (!data.months?.length) {
        Swal.fire("ไม่มีข้อมูล", "ยังไม่มีข้อมูลรายเดือน กรุณากด Sync เดือนก่อน", "info");
        return;
      }

      const headers = [
        "เดือน",
        "ปี (พ.ศ.)",
        "ค่าเฉลี่ย PM2.5 (µg/m³)",
        "จำนวนข้อมูล (ชม.)",
        "อัปเดตล่าสุด",
      ];
      const rows = data.months.map((m) => [
        m.fullName,
        m.year + 543,
        m.avg,
        m.count,
        formatSyncedAt(m.syncedAt),
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map(csvCell).join(",")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pm25-monthly-report-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      Swal.fire("ผิดพลาด", error.message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export CSV รายเดือน
    </button>
  );
}
```

จุดที่ยึดจาก pattern เดิม:
- `csvCell` (escape `"` เป็น `""` แล้วครอบ quote) + BOM `"\ufeff"` + Blob download — คัดจาก `components/complaints/ExportComplaints.js`
- `m.fullName` มีรูปแบบ "ม.ค. 2569" (ชื่อเดือน + ปี พ.ศ.) อยู่แล้วจาก `lib/pm25Data.js` — ใช้เป็นคอลัมน์ "เดือน" ได้ตรง spec
- Bearer token ผ่าน `useAuth().getToken` — แบบเดียวกับ `authHeaders()` ในหน้า pm25-settings
- collection ว่าง → Swal info "ยังไม่มีข้อมูลรายเดือน กรุณากด Sync เดือนก่อน" ตาม spec (ปุ่มในหน้า settings ใช้ชื่อ "Sync เดือน")

- [ ] **Step 2: ตรวจ lint**

Run: `npm run lint`
Expected: ผ่าน ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add components/pm25/ExportPm25Monthly.jsx
git commit -m "feat(pm25): component ปุ่ม export CSV รายเดือน (UTF-8+BOM)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: วางปุ่มในหน้า `/admin/pm25-settings`

**Files:**
- Modify: `pages/admin/pm25-settings.jsx` (import ที่หัวไฟล์ + card ใหม่หลัง card "Cache MongoDB" ~บรรทัด 250)

- [ ] **Step 1: เพิ่ม import**

ในบล็อก import ที่หัวไฟล์ `pages/admin/pm25-settings.jsx` (หลังบรรทัด `import { RefreshCw, Save, Cloud, Sheet, Radio } from "lucide-react";`) เพิ่ม:

```jsx
import ExportPm25Monthly from "@/components/pm25/ExportPm25Monthly";
```

- [ ] **Step 2: เพิ่ม card "รายงานรายเดือน"**

หา card "Cache MongoDB" — จบที่ closing tag สามชั้นนี้ (ก่อน card "Railway Cron"):

```jsx
                  {recentLogs.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      <p className="font-medium mb-1">Log ล่าสุด</p>
                      {recentLogs.map((l, i) => (
                        <p key={i}>{l.job}: {l.success ? "OK" : "FAIL"} — {l.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
```

แทรก card ใหม่**ถัดจาก** closing `</div></div>` ของ card Cache (ก่อน `<div className="card bg-white shadow">` ของ Railway Cron):

```jsx
              <div className="card bg-white shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">รายงานรายเดือน</h2>
                  <p className="text-sm text-gray-600">
                    Export ค่าเฉลี่ย PM2.5 รายเดือนทั้งหมดที่เก็บไว้ ({cache?.monthsCount || 0} เดือน)
                    เป็นไฟล์ CSV แบบ UTF-8 + BOM เปิดใน Excel ภาษาไทยไม่เพี้ยน
                  </p>
                  <div className="card-actions justify-end mt-2">
                    <ExportPm25Monthly />
                  </div>
                </div>
              </div>
```

(`cache` เป็น state ที่มีอยู่แล้วในหน้า — โชว์จำนวนเดือนให้เจ้าหน้าที่เห็นก่อนกด)

- [ ] **Step 3: ตรวจ lint + build sanity**

Run: `npm run lint`
Expected: ผ่าน ไม่มี error ใหม่

- [ ] **Step 4: Commit**

```bash
git add pages/admin/pm25-settings.jsx
git commit -m "feat(pm25): ปุ่ม Export CSV รายเดือนบนหน้า pm25-settings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: อัปเดตเอกสารโมดูล `docs/modules/pm25.md`

**Files:**
- Modify: `docs/modules/pm25.md` (CLAUDE.md กำหนดให้อัปเดตทุกครั้งที่โครงสร้างโมดูลเปลี่ยน)

- [ ] **Step 1: เพิ่มบรรทัดในหัวข้อ "หน้า / Components"**

แก้บรรทัด:

```markdown
- `/admin/pm25-settings` — สลับโหมดแหล่งข้อมูล (Sheet / DustBoy API)
```

เป็น:

```markdown
- `/admin/pm25-settings` — สลับโหมดแหล่งข้อมูล (Sheet / DustBoy API) + ปุ่ม
  Export CSV รายงานรายเดือน (`components/pm25/ExportPm25Monthly.jsx` —
  โฟลเดอร์แรกของโมดูลนี้ใน `components/`)
```

- [ ] **Step 2: เพิ่มบรรทัดในหัวข้อ "API / Cron"**

แก้บรรทัด:

```markdown
- `pages/api/pm25/*` (มี `_auth.js` ของตัวเอง)
```

เป็น:

```markdown
- `pages/api/pm25/*` (มี `_auth.js` ของตัวเอง)
- `GET /api/pm25/monthly-report` — ทุกเดือนจาก `Pm25Monthly` (เรียงเก่า→ใหม่)
  สำหรับปุ่ม export CSV บนหน้า pm25-settings (ป้องกันด้วย `requirePm25Admin`)
```

- [ ] **Step 3: Commit**

```bash
git add docs/modules/pm25.md
git commit -m "docs(pm25): บันทึกปุ่ม export รายเดือน + API monthly-report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ตรวจรับรวมกับข้อมูลจริง (manual)

**Files:** ไม่มีไฟล์ใหม่ — ขั้นตรวจรับตาม spec หัวข้อ "การทดสอบ"

- [ ] **Step 1: รัน dev แล้วตรวจหน้าเว็บจริง**

Run: `npm run dev` แล้วเปิด `http://localhost:3000/admin/pm25-settings` (ล็อกอินด้วย user ที่มีสิทธิ์)

ตรวจ:
1. เห็น card "รายงานรายเดือน" พร้อมจำนวนเดือนตรงกับ "กราฟเดือน: N เดือน" ใน card Cache
2. กด "Export CSV รายเดือน" → ได้ไฟล์ `pm25-monthly-report-<วันนี้>.csv`
3. เปิดไฟล์ใน Excel/Numbers: หัวคอลัมน์ภาษาไทยไม่เพี้ยน, จำนวนแถวข้อมูล = จำนวนเดือนใน collection `pm25_monthly`, เรียงเก่า→ใหม่, ค่า avg ตรงกับข้อมูลจริง

- [ ] **Step 2: ตรวจกรณีที่แก้ไม่ได้ด้วยตา — เทียบกับ Mongo**

ถ้ามี access DB: นับ document ใน `pm25_monthly` เทียบจำนวนแถว CSV
(หรืออย่างน้อยเทียบกับ `monthsCount` ที่หน้า settings แสดง)

- [ ] **Step 3: สรุปผลการตรวจให้ผู้ใช้ + เข้าสู่ finishing-a-development-branch**

รายงานผลตามจริง (ผ่าน/ไม่ผ่านข้อไหน) แล้วใช้ skill
`superpowers:finishing-a-development-branch` เพื่อเลือก push / เปิด PR เข้า `main`
(ตาม workflow ของโปรเจกต์: merge เข้า main = deploy Railway ทันที)
