# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ไฟล์นี้เป็นคู่มือสำหรับ Claude Code เวลาทำงานในโปรเจกต์นี้ — ภาษาอังกฤษเป็นเนื้อหาหลัก ภาษาไทยกำกับเพื่อให้อ่านเข้าใจเร็วขึ้น

## Commands / คำสั่งที่ใช้บ่อย

- `npm run dev` — start Next.js dev server (http://localhost:3000) / รันเซิร์ฟเวอร์โหมดพัฒนา
- `npm run build` / `npm start` — production build / serve / บิลด์และรันโหมดโปรดักชัน
- `npm run lint` — `next lint` (ESLint extends `next/core-web-vitals` + `next/typescript`) / ตรวจโค้ดด้วย ESLint
- **No test runner is configured** / โปรเจกต์นี้ยังไม่มี test runner ติดตั้งไว้
- `npm run create-default-activity` และ `npm run migrate-feedback` อ้างถึงไฟล์ใน `scripts/` แต่โฟลเดอร์นั้น **ไม่มีอยู่จริง** ในเรโพ — ถือว่าเป็นสคริปต์เก่า/ใช้ครั้งเดียว เว้นแต่จะมีคนเอากลับมา

## Stack & conventions / สแตกและธรรมเนียมการเขียน

- **Next.js 15 Pages Router** (`pages/`, ไม่ใช่ `app/`) + React 19 + TypeScript `strict: true`, `allowJs: true`. Path alias `@/*` → repo root
- ไฟล์ผสม `.ts` / `.tsx` / `.js` / `.jsx` — เวลาเพิ่มไฟล์ใหม่ให้เลียนแบบไฟล์ข้างเคียงในโฟลเดอร์เดียวกัน
- ข้อความใน UI, คอมเมนต์, และไฟล์ `*.md` ที่ root ส่วนใหญ่เป็น**ภาษาไทย** — เวลาเขียน UI ใหม่ให้ใช้ภาษาไทยเป็น default
- Styling: **Tailwind v4 + DaisyUI** (global CSS อยู่ที่ `styles/globals.css`)
- State management: **Zustand** (`stores/`) — ไม่มี Redux
- Data layer: **MongoDB + Mongoose** / Auth: **Clerk** (`@clerk/nextjs`) / Images: **Cloudinary** / External data: **Google Sheets API**, **DustBoy PM2.5 API**

## Big-picture architecture / ภาพรวมสถาปัตยกรรม

โปรเจกต์นี้คือพอร์ทัล "smart city" ของ**เทศบาลตำบลตาคลี** ที่รวมโมดูลฟีเจอร์หลายตัว (semi-independent) ไว้หลัง shell แอดมินตัวเดียวกันที่ล็อกอินผ่าน Clerk

### Multi-tenant App ID gating / การควบคุมสิทธิ์ข้ามแอปด้วย App ID

Clerk org และ Mongo collection `users` ถูก**แชร์ข้ามดีพลอย** (sibling apps) — ตัวแปร **`NEXT_PUBLIC_APP_ID`** (เช่น `"smart-takhli"`) เป็นตัวบอกว่า deployment นี้คือแอปไหน

ผู้ใช้จะเข้าได้ต่อเมื่ออย่างใดอย่างหนึ่งเป็นจริง:

1. Clerk `publicMetadata.allowedApps` ของ user ประกอบด้วย `APP_ID` ปัจจุบัน (หรือ `"*"`), **หรือ**
2. `users.appId` ใน Mongo เท่ากับ `APP_ID` ปัจจุบัน

**Superadmin** (`publicMetadata.role === "superadmin"`) ข้ามทุกการตรวจสอบ

จุดตรวจสอบหลักอยู่ที่ `pages/api/auth/verify-app-access.js` และ `pages/_app.tsx` จะเรียก endpoint นี้ทุกครั้งที่เปลี่ยน route ใน `/admin/*` หรือ `/user/*` พร้อมแสดงหน้า access-denied โดยอิงเหตุผล: `user_not_registered | no_app_assigned | app_mismatch | no_access`

### Two-layer permissions / สิทธิ์สองชั้น

ชั้นนอกคือ App access (ด้านบน) ชั้นในคือ **page access** ใน `lib/permissions.ts`:

- `ALL_PAGES` — registry หลักของหน้า admin/user (path, label, icon, category)
- `DEFAULT_PERMISSIONS[role]` — ถูกใช้เมื่อ user ไม่มี `allowedPages` ของตัวเองใน Mongo
- ถ้า `allowedPages` ใน Mongo doc ของ user **ไม่ว่าง** จะ override ค่า default — superadmin ยังคงข้ามได้
- `SUPERADMIN_ONLY_PAGES` — รายการ path ที่เฉพาะ superadmin เท่านั้น (เช่น `/admin/superadmin/*`)

> **สำคัญ:** เวลาเพิ่มหน้า `/admin/...` ใหม่ ต้อง**ลงทะเบียนใน `ALL_PAGES`** (และอาจจะ `DEFAULT_PERMISSIONS`) ไม่งั้นเมนูจะไม่ขึ้น และผู้ใช้เดิมอาจสูญเสียสิทธิ์เมื่อ refresh permission

### Auth patterns in API handlers / รูปแบบการตรวจสิทธิ์ใน API

- **API ที่ผู้ใช้แอดมินเรียก** — ใช้ `getAuth(req)` + `clerkClient` แล้ว re-verify app/role/page บนเซิร์ฟเวอร์อีกครั้ง ดูตัวอย่างมาตรฐานที่ `lib/pm25CronAuth.js#requirePm25Admin` (lookup Mongo → match `appId` → เช็ค `allowedPages` → superadmin ลัด)
- **Cron endpoints** ภายใต้ `pages/api/cron/**` **ไม่ได้** ใช้ Clerk แต่ใช้ `requireCronSecret(req)` (`lib/pm25CronAuth.js`) ที่เช็ค `CRON_SECRET` กับ header `x-cron-secret` หรือ query `?secret=` — **อย่าใส่ Clerk middleware ให้ endpoint cron**
- `middleware.js` คือ `clerkMiddleware()` ธรรมดา จำกัด scope ที่ `/admin/:path*`, `/user/:path*`, `/api/:path*`

### MongoDB & schema drift / ฐานข้อมูลและเรื่อง schema เพี้ยน

- `lib/dbConnect.js` อ่าน **`MONGO_URI`** (ไม่ใช่ `MONGODB_URI`) และแคชคอนเนกชันที่ `globalThis.mongoose` — เอกสาร/env บางที่อ้างถึง `MONGODB_URI` ระวังให้ใช้ตัวเดียวกัน
- โฟลเดอร์ `models/` คือ schema มาตรฐาน **แต่** API handler หลายไฟล์ (เช่น `verify-app-access.js`, `pm25CronAuth.js`) **redefine User schema แบบย่อแบบ inline** ด้วย `mongoose.models.User || mongoose.model("User", schema)` — เวลาเพิ่มฟิลด์ใน User model ต้องอัปเดต **ทั้ง** `models/CreateUser.js` **และ** inline schema ทุกที่ ไม่งั้นฟิลด์จะ "หาย" จากผลคิวรีอย่างเงียบ ๆ

### Feature modules / โมดูลฟีเจอร์ (โดยคร่าวแต่ละโมดูล = หนึ่ง route prefix + ชุด model)

- **Complaints / ร้องเรียน** — `pages/complaint`, `pages/status`, `pages/admin/manage-complaints`, API `pages/api/complaints`, `pages/api/problems.js`. ระบบ PDPA / "เรื่องลับ" อยู่ที่ `lib/complaintPrivacy.js`; การเบลอภาพใช้ Cloudinary `e_blur` URL transform ส่วนการเซ็นเซอร์ข้อความเก็บเป็น `pdpaDetailRedactions` (array `{start, end}`) ที่แอดมินลากเลือกใน `ComplaintDetailModal.js`. ฟังก์ชัน `lib/pdpaTextMask.js#maskSensitiveWords` ยังอยู่แต่ **ไม่ได้ใช้กับ flow ร้องเรียนสาธารณะแล้ว**
- **Smart Health / สุขภาพ** — ระบบยืม-คืนอุปกรณ์, เยี่ยมผู้สูงอายุ, สุขภาพพนักงาน. Components ใน `components/sm-health/`, `components/elderly/`; API `pages/api/smart-health/*`; models ได้แก่ `ElderlyPerson`, `ElderlyVisit`, `ElderlyMentalHealthAssessment`, `EmployeeHealthRecord`, `EmployeePerson`, `MenuHealthModel`, `RegisterHealthModel`, `SubmittedReport`
- **Smart Papar (คุณภาพน้ำประปา)** — `pages/admin/smart-papar/water-quality.jsx`, API `pages/api/smart-papar/water-quality/`, model `models/smart-papar/WaterQualityDaily.js`. Google Sheets → MongoDB upsert ราย Bangkok `recordDate` ลง collection `smart_papar_water_quality_daily`. Sync แบบ manual ผ่าน `POST /api/smart-papar/water-quality/sync-sheet` (ป้องกันด้วย Clerk) และ sync อัตโนมัติผ่าน `POST /api/cron/smart-papar/water-quality-sync` (ป้องกันด้วย `CRON_SECRET`)
- **PM2.5 (DustBoy)** — หน้า public/home อ่าน PM2.5 **จาก Mongo cache เท่านั้น** (`Pm25Latest`, `Pm25DailySnapshot`, `Pm25Monthly`); DustBoy API จะถูกเรียก**เฉพาะ cron**. Logic อยู่ที่ `lib/pm25Sync.js` + `lib/pm25Data.js`, ตารางเวลา (Asia/Bangkok): `5 * * * *` (รายชม.), `15 0 * * *` (daily, 7 วันย้อนหลัง), `0 3 * * *` (monthly). สลับโหมดแหล่งข้อมูลที่ `/admin/pm25-settings` (model `Pm25Settings`)
- **Education / โรงเรียน + ความเห็นนักเรียน** — `pages/api/education/*`, `pages/api/student-feedback/*`, models `StudentFeedback`, `EducationRegisterModel`, `ElderlySchoolSchedule`. ความเห็นถูก **scope ตาม Activity** (`models/Activity.js`, `pages/api/activities/*`) เพื่อไม่ให้กิจกรรมเก่าปนกับกิจกรรมใหม่ — `StudentFeedback.activityId` เป็น required
- **User satisfaction / แบบประเมินความพึงพอใจ** — `pages/user/satisfaction.jsx`, `components/SatisfactionForm.js`, model `Satisfaction`. หน้า analysis สำหรับแอดมินที่ `/admin/feedback-analysis`
- **Superadmin** — `pages/admin/superadmin/` (จัดการ user/permission) + `pages/api/permissions/*`. การตั้งค่าครั้งแรกที่ `/admin/superadmin/setup` ป้องกันด้วย env `SUPERADMIN_SECRET`

### Required env vars / ตัวแปรแวดล้อมที่ต้องมีใน `.env.local`

`MONGO_URI`, `NEXT_PUBLIC_APP_ID`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CRON_SECRET`, `SUPERADMIN_SECRET` (สำหรับตั้ง superadmin ครั้งแรก), `NEXT_PUBLIC_CLOUDINARY_*`, `DUSTBOY_API_KEY` / `DUSTBOY_STATION_ID` / `DUSTBOY_API_BASE`, `GOOGLE_SHEETS_SPREADSHEET_ID` (+ `GOOGLE_SHEETS_SHEET_NAME` / service-account pair เมื่อ sheet ไม่ได้แชร์แบบ link-share), `ELDERLY_SCHOOL_SHEET_CSV_URL`, และเลือกใส่ `BACKEND_API_URL` / `NEXT_PUBLIC_BACKEND_API_URL` ถ้าจำเป็น
