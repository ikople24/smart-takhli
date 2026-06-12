# Activity Feed (ข่าวกิจกรรม) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ฟีด "ข่าวกิจกรรม" สไตล์เว็บหน่วยงาน — แอดมินโพสต์กิจกรรม+รูป (≤6), แสดงการ์ดข่าวบนหน้าหลัก พร้อมคะแนนความพึงพอใจจริงและยอดผู้เข้าชม

**Architecture:** ขยาย `Activity` model เดิม (`images[]`, `views`) ไม่สร้าง model ใหม่; endpoint `feed` aggregate คะแนนจาก `StudentFeedback` สด; components ใหม่อยู่ `components/activities/` ตาม convention; ปิดช่องโหว่ API write ด้วย auth helper ตาม pattern `pages/api/pm25/_auth.js` แต่ใช้ `hasPermission` กลาง

**Tech Stack:** Next.js 15 Pages Router, Mongoose, Clerk, Cloudinary (ผ่าน `components/ImageUploads.js` เดิม), Tailwind+DaisyUI

**Spec:** `docs/superpowers/specs/2026-06-12-activity-feed-design.md`

**หมายเหตุการทดสอบ:** โปรเจกต์ไม่มี test runner (CLAUDE.md) — ทุก task ตรวจด้วย `npm run build` + curl/dev server แทน unit test

---

### Task 1: Model — เพิ่ม `images` + `views` ใน Activity

**Files:**
- Modify: `models/Activity.js`

- [ ] **Step 1.1:** เพิ่มฟิลด์ใน schema (หลัง `isDefault`, ก่อน `createdAt`):

```js
  images: {
    type: [String],
    default: [],
    validate: {
      validator: (arr) => arr.length <= 6,
      message: 'อัปโหลดรูปได้สูงสุด 6 รูป'
    }
  },
  views: {
    type: Number,
    default: 0
  },
```

- [ ] **Step 1.2:** Run `npm run build` → ต้อง `✓ Compiled successfully`
- [ ] **Step 1.3:** Commit: `feat: Activity model เพิ่ม images (สูงสุด 6) + views`

---

### Task 2: Auth helper + ปิด POST/PUT/DELETE

**Files:**
- Create: `pages/api/activities/_auth.js`
- Modify: `pages/api/activities/index.js` (case POST), `pages/api/activities/[id].js` (case PUT, DELETE)

- [ ] **Step 2.1:** สร้าง `pages/api/activities/_auth.js` (pattern เดียวกับ `pages/api/pm25/_auth.js` แต่เช็คเพจด้วย `hasPermission` กลาง — รองรับนโยบาย allowedPages ว่าง=ชุดพื้นฐาน):

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/manage-activities";

// ⚠️ inline User schema (จำเป็นตาม pattern ปัจจุบัน — เฟส 6 จะรวมเป็นที่เดียว)
// ถ้าเพิ่มฟิลด์ใน models/CreateUser.js ต้องตามมาแก้ที่นี่ด้วย
export async function requireActivitiesAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true };
  }

  await dbConnect();
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }
  if (!hasPermission(mongoUser.role || role, mongoUser.allowedPages, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false };
}
```

- [ ] **Step 2.2:** ใน `pages/api/activities/index.js` — import แล้วกั้นเฉพาะ POST (GET ยัง public):

```js
import { requireActivitiesAdmin } from "./_auth";
```

ใน `case 'POST':` บรรทัดแรกสุดของ try:

```js
        const auth = await requireActivitiesAdmin(req);
        if (!auth.ok) {
          return res.status(auth.status).json({ success: false, message: auth.message });
        }
```

- [ ] **Step 2.3:** ใน `pages/api/activities/[id].js` — import เดียวกัน (`from "./_auth"`) แล้วใส่ block เดียวกันที่ต้นของ `case 'PUT':` และ `case 'DELETE':` (GET ยัง public)
- [ ] **Step 2.4:** ตรวจ: `npm run build` ผ่าน แล้วรัน dev + `curl -s -X POST localhost:<port>/api/activities -H 'Content-Type: application/json' -d '{}'` → ต้องได้ `{"success":false,"message":"Unauthorized"}` (401)
- [ ] **Step 2.5:** Commit: `fix: เพิ่ม auth ให้ POST/PUT/DELETE /api/activities (เดิมเปิดโล่ง)`

---

### Task 3: API รับ `images` + validate ≤ 6

**Files:**
- Modify: `pages/api/activities/index.js` (POST), `pages/api/activities/[id].js` (PUT)

- [ ] **Step 3.1:** ใน POST (`index.js`) — destructure เพิ่ม `images` จาก `req.body` แล้ว validate ก่อนสร้าง:

```js
        const images = Array.isArray(req.body.images)
          ? req.body.images.filter((u) => typeof u === "string")
          : [];
        if (images.length > 6) {
          return res.status(400).json({ success: false, message: "อัปโหลดรูปได้สูงสุด 6 รูป" });
        }
```

และเพิ่ม `images,` ใน `new Activity({ ... })`

- [ ] **Step 3.2:** ใน PUT (`[id].js`) — validate แบบเดียวกัน (โค้ดเดียวกับ Step 3.1) และเพิ่มใน object ของ `findByIdAndUpdate`:

```js
            images,
```

- [ ] **Step 3.3:** `npm run build` ผ่าน → Commit: `feat: API activities รับ images สูงสุด 6 รูป`

---

### Task 4: `GET /api/activities/feed` — ฟีดพร้อมสถิติ

**Files:**
- Create: `pages/api/activities/feed.js`

- [ ] **Step 4.1:** สร้างไฟล์:

```js
import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";
import StudentFeedback from "@/models/StudentFeedback";

// ฟีดข่าวกิจกรรม (public): กิจกรรม active เรียงใหม่→เก่า พร้อมคะแนนเฉลี่ยจาก StudentFeedback
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);

    const activities = await Activity.find({ isActive: true })
      .sort({ startDate: -1 })
      .limit(limit)
      .lean();

    const ids = activities.map((a) => a._id);
    const stats = await StudentFeedback.aggregate([
      { $match: { activityId: { $in: ids }, isApproved: true } },
      {
        $group: {
          _id: "$activityId",
          avgRating: { $avg: "$emotionLevel" },
          count: { $sum: 1 },
        },
      },
    ]);
    const statMap = new Map(stats.map((s) => [String(s._id), s]));

    const data = activities.map((a) => {
      const s = statMap.get(String(a._id));
      return {
        ...a,
        stats: {
          avgRating: s ? Math.round(s.avgRating * 10) / 10 : null,
          count: s ? s.count : 0,
        },
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
```

- [ ] **Step 4.2:** ตรวจ: dev + `curl -s "localhost:<port>/api/activities/feed?limit=3"` → `success: true`, ทุก item มี `stats: { avgRating, count }`
- [ ] **Step 4.3:** Commit: `feat: GET /api/activities/feed — ฟีดกิจกรรม + คะแนนเฉลี่ยจาก StudentFeedback`

---

### Task 5: `POST /api/activities/[id]/view` — นับผู้เข้าชม

**Files:**
- Create: `pages/api/activities/[id]/view.js` (โฟลเดอร์ `[id]/` อยู่ร่วมกับไฟล์ `[id].js` ได้ใน Pages Router)

- [ ] **Step 5.1:** สร้างไฟล์:

```js
import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";

// นับยอดเข้าชม (public, fire-and-forget จาก client — กันซ้ำด้วย sessionStorage ฝั่ง client)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const { id } = req.query;
    const activity = await Activity.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: "views" }
    );
    if (!activity) {
      return res.status(404).json({ success: false, message: "Activity not found" });
    }
    return res.status(200).json({ success: true, views: activity.views });
  } catch (error) {
    console.error("Error counting activity view:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
```

- [ ] **Step 5.2:** ตรวจ: `curl -s -X POST localhost:<port>/api/activities/<id จริง>/view` สองครั้ง → `views` เพิ่มทีละ 1
- [ ] **Step 5.3:** Commit: `feat: POST /api/activities/[id]/view นับยอดผู้เข้าชม`

---

### Task 6: `ImageUploads` รับ `maxImages` + `initialImages`

**Files:**
- Modify: `components/ImageUploads.js`

จุดเรียกเดิม (`ComplaintFormModal.js`) ไม่ส่ง props ใหม่ → default 3 + [] = พฤติกรรมเดิมเป๊ะ

- [ ] **Step 6.1:** เปลี่ยน signature และ state เริ่มต้น:

```js
const ImageUploads = ({ onChange, onUploadingChange, maxImages = 3, initialImages = [] }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState(initialImages);
```

- [ ] **Step 6.2:** แทนเลข `3` hardcode 3 จุดใน `handleFiles`:
  - `if (previews.length >= 3)` → `if (previews.length >= maxImages)`
  - ข้อความ confirm → `` `คุณอัปโหลดครบ ${maxImages} ภาพแล้ว ต้องการแทนที่ภาพแรกหรือไม่?` ``
  - `const remainingSlots = 3 - previews.length;` → `const remainingSlots = maxImages - previews.length;`
- [ ] **Step 6.3:** `npm run build` ผ่าน → Commit: `refactor: ImageUploads รับ prop maxImages + initialImages (default เดิม 3)`

---

### Task 7: Admin — อัปโหลดรูปใน modal + thumbnail/views ในตาราง

**Files:**
- Modify: `pages/admin/manage-activities.jsx`

- [ ] **Step 7.1:** import เพิ่มบนหัวไฟล์:

```js
import Image from 'next/image';
import ImageUploads from '@/components/ImageUploads';
```

- [ ] **Step 7.2:** `formData` เริ่มต้นเพิ่ม `images: []` (ทั้งใน `useState` และ `resetForm`); ใน `handleEdit` เพิ่ม `images: activity.images || []`
- [ ] **Step 7.3:** ใน modal form — เพิ่ม block ก่อน checkbox `isDefault`:

```jsx
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รูปภาพกิจกรรม (สูงสุด 6 รูป)
                  </label>
                  <ImageUploads
                    key={editingActivity?._id || 'new'}
                    maxImages={6}
                    initialImages={formData.images}
                    onChange={(urls) => setFormData(prev => ({ ...prev, images: urls }))}
                  />
                </div>
```

(`key` บังคับ remount เมื่อสลับกิจกรรม เพื่อให้ `initialImages` ถูกตั้งใหม่)

- [ ] **Step 7.4:** ตาราง — ในเซลล์ชื่อกิจกรรม เพิ่ม thumbnail หน้าชื่อ + ยอดวิว:

```jsx
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {activity.images?.[0] ? (
                            <Image
                              src={activity.images[0]}
                              alt={activity.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">📅</div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {activity.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              👁 {activity.views || 0} ผู้เข้าชม
                            </div>
                          </div>
                        </div>
                      </td>
```

(แทนที่เซลล์แรกเดิมที่แสดง name + description)

- [ ] **Step 7.5:** ตรวจ: dev → สร้างกิจกรรมพร้อมรูป 2 รูป, แก้ไขแล้วรูปเดิมโชว์, ลองอัปรูปเกิน 6 → component กันเอง
- [ ] **Step 7.6:** Commit: `feat: จัดการกิจกรรม — อัปโหลดรูป (≤6) + thumbnail/views ในตาราง`

---

### Task 8: Components ฟีดข่าว — `components/activities/`

**Files:**
- Create: `components/activities/ActivityFeedCard.jsx`
- Create: `components/activities/ActivityFeed.jsx`

- [ ] **Step 8.1:** สร้าง `ActivityFeedCard.jsx`:

```jsx
import Image from "next/image";
import Link from "next/link";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiDate(dateString) {
  const d = new Date(dateString);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// การ์ดข่าวกิจกรรมแนวตั้ง: รูปปก 16:9 + ป้ายวันที่ + พาดหัว + เนื้อหาย่อ + คะแนน/ยอดวิว
export default function ActivityFeedCard({ activity }) {
  const cover = activity.images?.[0];
  const stats = activity.stats || { avgRating: null, count: 0 };

  return (
    <Link
      href={`/activities?activity=${activity._id}`}
      className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-video bg-gradient-to-br from-indigo-100 to-blue-200">
        {cover ? (
          <Image src={cover} alt={activity.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl">📅</div>
        )}
        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
          📅 {formatThaiDate(activity.startDate)}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2">{activity.name}</h3>
        {activity.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
        )}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            {stats.count > 0
              ? `⭐ ${stats.avgRating?.toFixed(1)} (${stats.count} ความเห็น)`
              : "ยังไม่มีความเห็น"}
          </span>
          <span>👁 {activity.views || 0}</span>
        </div>
        <span className="inline-block mt-2 text-sm font-medium text-blue-600">อ่านต่อ →</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 8.2:** สร้าง `ActivityFeed.jsx`:

```jsx
import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityFeedCard from "./ActivityFeedCard";

// section "ข่าวกิจกรรม" — ใช้บนหน้าหลัก (showViewAll) และหน้า /activities
export default function ActivityFeed({ limit = 3, showViewAll = false }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activities/feed?limit=${limit}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
      })
      .catch((e) => console.error("Error fetching activity feed:", e))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading || activities.length === 0) return null;

  return (
    <section className="w-full max-w-5xl mx-auto px-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">📰 ข่าวกิจกรรม</h2>
        {showViewAll && (
          <Link href="/activities" className="text-sm text-blue-600 hover:underline">
            ดูกิจกรรมทั้งหมด →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activities.map((a) => (
          <ActivityFeedCard key={a._id} activity={a} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8.3:** `npm run build` ผ่าน → Commit: `feat: components/activities — ActivityFeed + ActivityFeedCard สไตล์ข่าว`

---

### Task 9: หน้าหลัก — ฟีดแทน section ฟอร์มเดิม

**Files:**
- Modify: `pages/index.tsx`

- [ ] **Step 9.1:** เปลี่ยน import บรรทัด `import ActivityFeedbackForm from "@/components/ActivityFeedbackForm";` → `import ActivityFeed from "@/components/activities/ActivityFeed";`
- [ ] **Step 9.2:** แทนที่ block "ส่วนแสดงความคิดเห็นของนักเรียนนักศึกษา" (div ที่ครอบ `<ActivityFeedbackForm selectedActivity={null} />`) ด้วย:

```jsx
            {/* ข่าวกิจกรรม */}
            <div className="flex flex-col items-center mt-4 mb-2 p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-grid *:[grid-area:1/1]">
                  <div className="status status-info status-lg animate-ping"></div>
                  <div className="status status-info status-lg"></div>
                </div>
                <span className="font-bold text-indigo-400">ACTIVITY NEWS</span>
              </div>
              <ActivityFeed limit={3} showViewAll />
            </div>
```

- [ ] **Step 9.3:** ตรวจว่าไม่มีการใช้ `ActivityFeedbackForm` อื่นใน index.tsx (เดิมมีจุดเดียว)
- [ ] **Step 9.4:** `npm run build` + เปิดหน้าหลักใน dev → เห็นการ์ดข่าว ≤3 ใบ → Commit: `feat: หน้าหลักแสดงฟีดข่าวกิจกรรมแทนฟอร์มความคิดเห็น`

---

### Task 10: หน้า `/activities` — การ์ดข่าว + gallery + preselect + นับวิว

**Files:**
- Modify: `pages/activities.tsx`

- [ ] **Step 10.1:** ปรับ interface + การ fetch — ใช้ feed endpoint (ได้ stats+views มาด้วย) และรองรับ `?activity=`:

```tsx
import { useRouter } from 'next/router';
import Image from 'next/image';
import { formatThaiDate } from '@/components/activities/ActivityFeedCard';

interface Activity {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isDefault: boolean;
  images?: string[];
  views?: number;
  stats?: { avgRating: number | null; count: number };
}
```

ใน component: `const router = useRouter();` และเปลี่ยน `useEffect` เป็น:

```tsx
  useEffect(() => {
    if (!router.isReady) return;
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);
```

ใน `fetchActivities` เปลี่ยน URL เป็น `/api/activities/feed?limit=50` และเลือก preselect:

```tsx
        const fromQuery =
          typeof router.query.activity === 'string'
            ? data.data.find((a: Activity) => a._id === router.query.activity)
            : null;
        const defaultActivity =
          fromQuery || data.data.find((a: Activity) => a.isDefault) || data.data[0];
```

- [ ] **Step 10.2:** เพิ่ม effect นับวิว (หลัง state declarations):

```tsx
  // นับผู้เข้าชมเมื่อเปิดดูรายละเอียด — 1 ครั้ง/กิจกรรม/session
  useEffect(() => {
    if (!selectedActivity) return;
    const key = `activity-viewed-${selectedActivity._id}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      fetch(`/api/activities/${selectedActivity._id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [selectedActivity]);
```

- [ ] **Step 10.3:** การ์ดในกริด — เพิ่มรูปปกเหนือเนื้อหา (ใน div การ์ด ก่อน `<div className="p-6">`):

```tsx
                <div className="relative aspect-video bg-gradient-to-br from-indigo-100 to-blue-200">
                  {activity.images?.[0] ? (
                    <Image src={activity.images[0]} alt={activity.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">📅</div>
                  )}
                </div>
```

และในรายการ space-y-2 ด้านล่างของการ์ด เพิ่มบรรทัด:

```tsx
                    <div className="flex items-center">
                      <span className="mr-2">👁</span>
                      <span>{activity.views || 0} ผู้เข้าชม · {activity.stats?.count ? `⭐ ${activity.stats.avgRating?.toFixed(1)}` : 'ยังไม่มีความเห็น'}</span>
                    </div>
```

- [ ] **Step 10.4:** ส่วนรายละเอียดกิจกรรมที่เลือก (ก่อน `<ActivityFeedbackForm ...>`) — เพิ่ม gallery + meta:

```tsx
              {selectedActivity.images && selectedActivity.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {selectedActivity.images.map((img, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200">
                      <Image src={img} alt={`${selectedActivity.name} ${i + 1}`} fill sizes="33vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
```

และในแถว meta (`flex items-center gap-4 text-sm text-gray-500`) เพิ่ม `<span>👁 {selectedActivity.views || 0} ผู้เข้าชม</span>`

- [ ] **Step 10.5:** ตรวจ: dev →
  - `/activities` แสดงการ์ดมีรูป
  - `/activities?activity=<id>` preselect ถูกตัว
  - เปิดรายละเอียด → Mongo `views` +1, refresh ไม่เพิ่มซ้ำ (session เดิม)
  - ส่ง feedback จากฟอร์มยังทำงาน
- [ ] **Step 10.6:** Commit: `feat: หน้า /activities สไตล์ข่าว — gallery, preselect จาก query, นับผู้เข้าชม`

---

### Task 11: เอกสาร + verification รวม

**Files:**
- Modify: `docs/modules/activities.md`

- [ ] **Step 11.1:** อัปเดต `docs/modules/activities.md`: เปลี่ยน section "Design intent" เป็น "สถานะ: implemented (2026-06-12)" + เพิ่มรายการไฟล์ใหม่ (`pages/api/activities/feed.js`, `[id]/view.js`, `_auth.js`, `components/activities/*`) + บันทึกว่า write API มี auth แล้ว
- [ ] **Step 11.2:** Verification รวม:
  - `npm run lint` + `npm run build` ผ่าน
  - `grep -rn "ActivityFeedbackForm" pages/index.tsx` → ต้องว่าง
  - Checklist ใน spec ข้อ 1-5 ครบ (รวม security: POST ไม่ login → 401)
- [ ] **Step 11.3:** Commit: `docs: อัปเดต activities.md — ฟีดข่าวกิจกรรม implemented`

---

## Self-review notes (ทำแล้ว)

- ทุก spec requirement มี task รองรับ: model(1), auth(2), images API(3), feed(4), views(5), admin UI(6-7), components ข่าว(8), หน้าหลัก(9), /activities(10), docs(11)
- ชื่อ/ลายเซ็นสอดคล้อง: `requireActivitiesAdmin`, `stats.avgRating/count`, `formatThaiDate` export จาก ActivityFeedCard ใช้ใน activities.tsx
- ไม่มี placeholder; โค้ดทุก step สมบูรณ์
- `res.cloudinary.com` อยู่ใน `next.config.ts` images.domains แล้ว — `next/image` ใช้ได้เลย
