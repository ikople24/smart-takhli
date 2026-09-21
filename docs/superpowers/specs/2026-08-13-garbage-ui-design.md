# ระบบตารางเก็บขยะ — หน้าจอประชาชนและหลังบ้าน (M4–M5) · Design Spec

**วันที่:** 2026-08-13
**ต่อจาก:** M1–M3 (PR #116, branch `feat/garbage-schedule`) — โครงข้อมูล + API สาธารณะ 3 ตัว เสร็จและ seed ลง DB จริงแล้ว
**แพลนต้นทาง:** `docs/superpowers/plans/2026-08-12-garbage-schedule-m1-m3.md` (ส่วนท้ายระบุให้เขียนแพลน M4–M5 ใหม่หลัง M3 เสร็จ)

## เป้าหมาย

ให้ประชาชนค้นหาถนน/ชุมชนของตัวเองแล้วรู้ว่ารถขยะมาวันไหน เวลาไหน รถคันไหน และดูได้ว่าตอนนี้รถอยู่ช่วงไหนของเส้นทาง · ให้เจ้าหน้าที่กองสาธารณสุขเปิดดูตารางทั้งสัปดาห์จากหน้าแอดมินได้ พร้อมเมนูบนไซด์บาร์

**ขอบเขตรอบนี้:** อ่านอย่างเดียวสำหรับข้อมูลตาราง (การแก้ตารางยังทำผ่าน `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs`) ยกเว้นค่าตั้งค่าการแสดงผล (เบอร์ติดต่อ) ที่แก้ได้จากหน้าแอดมิน · การแก้ไขตารางรายวันจาก UI คือ M5+ รอบถัดไป

## สถานะข้อมูลที่ต้องออกแบบรองรับ

DB จริงมีตารางเฉพาะ **วันจันทร์และวันอังคาร** (17 assignments) ส่วนพุธ–อาทิตย์รอกองสาธารณสุข ดังนั้น "วันที่ยังไม่มีข้อมูล" คือสถานะปกติของ 5 ใน 7 วัน ไม่ใช่ edge case — ทั้งสองหน้าต้องบอกตรง ๆ ว่ารอข้อมูลอยู่ ไม่ใช่แสดงว่างเปล่าเงียบ ๆ

สาย R5–R7 มี `needsVerification: true` (ถอดจากโปสเตอร์ ยังไม่ผ่านการตรวจ) — หน้าแอดมินต้องเห็นป้ายเตือนนี้

## สถาปัตยกรรม

### API ใหม่: `GET /api/garbage/week`

`?date=YYYY-MM-DD` (ไม่ระบุ = วันนี้ตามเวลาไทย) คืนสัปดาห์ที่ครอบวันนั้น **เรียงอาทิตย์→เสาร์ (weekday 0–6) เสมอ** เพื่อให้ลำดับแท็บฝั่งแอดมินคงที่ไม่ขึ้นกับว่าวันนี้เป็นวันอะไร

```ts
{ startDate: string, endDate: string, days: ResolvedDaySchedule[] }  // days.length === 7 เสมอ
```

วันที่ไม่มีข้อมูลคืน `assignments: []` (ต้องมีอยู่ในอาเรย์ ห้ามหายไป — ฝั่ง UI ใช้ข้อมูลนี้บอกว่าวันไหนรอข้อมูล)

**เปิดสาธารณะเหมือน 3 endpoint เดิม** ไม่ใส่ Clerk — ข้อมูลชุดเดียวกับ `/api/garbage/schedule` ที่เปิดสาธารณะอยู่แล้ว จึงไม่มีข้อมูลใหม่รั่วออกและไม่ต้องเพิ่ม auth surface · Cache-Control `public, s-maxage=300, stale-while-revalidate=600` เท่ากับ `/schedule`

ใน `lib/garbage/resolve.ts` เพิ่ม:

- `buildWeekSchedule(dates, weekdays, assignments, routes, trucks)` — pure ไม่แตะ DB เรียก `buildDaySchedule` ต่อวัน (เทสได้)
- `resolveWeekSchedule(date)` — อ่าน DB **รอบเดียว** สำหรับทั้ง 7 วัน (คิวรี assignments ทั้งสัปดาห์ด้วย `weekday: { $in: [0..6] }` แทนการยิงรายวัน 7 ครั้ง)

ต้องระวัง: `pickLatestVersions` คีย์รวม `weekday` อยู่แล้ว (แก้ไว้ตอนรีวิว M1–M3) จึงใช้กับข้อมูลข้ามวันได้ปลอดภัย

### เพิ่มฟิลด์ใน `ResolvedAssignment`

`routeNeedsVerification: boolean` — resolver map มาจาก `route.needsVerification ?? false` เป็นการเพิ่มแบบ additive ไม่กระทบผู้ใช้เดิมของ type · จำเป็นเพราะหน้าแอดมินต้องแยกได้ว่าสายไหนยังไม่ผ่านการตรวจ

### ค่าตั้งค่าโมดูล (เบอร์ติดต่อ)

collection `garbage_settings` singleton (`key: "default"`) ตามแบบ `Pm25Settings`:

```ts
{ key: "default", contactPhone: string | null, contactNote: string | null, updatedBy: string | null }
```

- `GET /api/garbage/settings` — public (หน้าประชาชนต้องอ่านเบอร์ไปแสดง) คืนเฉพาะ `contactPhone`, `contactNote`
- `PUT /api/garbage/settings` — **ต้อง auth** ตามแบบ `pages/api/pm25/_auth.js#requirePm25Admin` (getAuth → lookup Mongo → เช็ค appId → เช็ค `allowedPages` ผ่าน `pathMatchesPermission('/admin/garbage', …)` → superadmin ลัด) บันทึก `updatedBy` เป็น clerkId
- ค่าเริ่มต้นเมื่อยังไม่มี doc: `contactPhone: null` → หน้าประชาชนซ่อนบรรทัดเบอร์โทรไปเลย ไม่แสดงข้อความค้าง

**ไม่ hardcode เบอร์โทรใด ๆ ในโค้ด** และไม่เดาเบอร์ — เจ้าหน้าที่กรอกเองจากหน้าแอดมิน

## M4 — หน้าประชาชน `/garbage`

`pages/garbage.tsx` (บาง) — ได้ `TopNavbar` + `BottomNav` + padding จาก `components/Layout.js` อัตโนมัติ **ห้ามเรนเดอร์ header/nav หรือ `<main>` ของตัวเอง** (คนละแบบกับ `elderly/checkin.tsx` ที่ซ้อน main) · กว้างสุดตามหน้าแรก mobile-first คอลัมน์เดียว

### ส่วนที่ 1 (บนสุด) — ค้นหา · `components/garbage/GarbageSearchPanel.tsx`

- input + `useDebounce(300ms)` (คัดลอกฮุคจาก `pages/admin/manage-complaints.jsx:21-34`)
- gate ที่ **≥2 ตัวอักษรฝั่ง client** จึงไม่มีทางได้ 400 จาก API
- `reqIdRef` กันผลลัพธ์เก่าแซงผลใหม่ (idiom จาก `components/smart-waste/admin/MonthTable.jsx`)
- ยิง `GET /api/garbage/search?q=` ผ่าน `URLSearchParams` — endpoint นี้คืนผลของ **ทุกวันในคำขอเดียว** จึงไม่ต้องวนยิงรายวัน
- ผลลัพธ์จัดกลุ่มตามวัน (`weekdayName` มาจาก server แล้ว) แต่ละรายการแสดง: `matchName`, ช่วงเวลาผ่าน `formatRange(startMin, endMin)` หรือเวลาถึงจุดผ่าน `formatThaiTime(atMin)`, เบอร์รถ, `routeCode`, ป้ายกำกับเมื่อ `kind === "substitute"` (แสดง "รถแทนเบอร์ N") หรือ `"special"`
- **ห้ามฟอร์แมตนาทีเอง** ต้องใช้ helper จาก `lib/garbage/time.ts` (ระบบ prototype เดิมมีบั๊ก `if (hour === '12') minutes = 0` ทำให้เวลาบ่ายเพี้ยนทั้งหมด)

### ส่วนที่ 2 — รถวันนี้ · `components/garbage/TodayTruckPanel.tsx`

- ยิง `GET /api/garbage/live` (ไม่ส่ง date = วันนี้ตามเวลาไทย) ทุก 60 วินาที ด้วย idiom `alive` flag + `clearInterval` จาก `components/smart-papar/WaterQualityCard.js:66-90`
- ต่อคันแสดง: เบอร์รถ + จุดสีตาม `truckColor`, สถานะจาก `live.status` (`running` → "กำลังวิ่ง", `upcoming` → "ยังไม่เริ่ม · อีก N นาที", `finished` → "เสร็จแล้ว", `unknown` → ไม่แสดงในกลุ่มนี้), `currentStop.name`, `nextStop.name` + `etaNextMin`
- รถที่ `kind === "day_off"` รวบเป็นบรรทัดเดียว ("วันนี้หยุด: รถ 1, 2, 3, 4")
- แสดงเวลา "อัปเดตล่าสุด HH.MM น." ทุกครั้งที่ดึงสำเร็จ

### แถบบอกความครอบคลุมข้อมูล

หน้านี้ยิง `GET /api/garbage/week` **ครั้งเดียวตอนเปิด** (cached 300 วิ) เพื่อรู้ว่าวันไหน `assignments.length === 0` จริง แล้วขึ้นแถบ info สีฟ้าระบุชื่อวันที่ยังไม่มีตาราง + ข้อความว่าอยู่ระหว่างจัดทำโดยกองสาธารณสุข + เบอร์ติดต่อจาก `/api/garbage/settings` (ซ่อนบรรทัดเบอร์ถ้ายังไม่ได้ตั้งค่า)

เหตุผลที่ต้องใช้ week: จาก `/search` อย่างเดียวแยกไม่ออกว่า "วันพุธไม่มีตารางเลย" กับ "ถนนนี้ไม่ได้เก็บวันพุธ"

### การ์ดหน้าแรก · `components/garbage/GarbageHomeCard.tsx`

**สำคัญ:** กริดไอคอนในหน้าแรกดึงจาก `useMenuStore` → `/api/menu` ซึ่งเป็น **proxy ไป backend ภายนอก** (`BACKEND_API_URL`) และรายการเมนูเปิด modal ไม่ได้ navigate — เพิ่มการ์ดใหม่ผ่าน collection `menu_list` **ไม่ได้** ต้อง hardcode JSX เหมือนที่ `Pm25Dashboard` / `WaterQualityCard` / `ActivityFeed` ทำอยู่

- แทรกใน `pages/index.tsx` หลังกริดเมนู (ประมาณบรรทัด 152) ใช้ section-header idiom เดิม (ping dot + หัวข้อตัวหนา)
- โครงการ์ดคัดลอกจาก `components/smart-papar/WaterQualityCard.js` (`rounded-xl shadow-md bg-white/30 backdrop-blur-md`) ครอบด้วย `next/link` → `/garbage`
- การ์ดแสดงข้อความสั้น + จำนวนรถที่กำลังวิ่งวันนี้ (ดึง `/api/garbage/live` ครั้งเดียว ไม่ poll เพื่อไม่ให้หน้าแรกหนัก) ถ้าโหลดไม่ได้แสดงแค่ข้อความชวนกด ไม่แสดง error

**ไม่แก้ `components/BottomNav.js`** — มี 3 ปุ่มใน `justify-around h-14` เพิ่มที่ 4 จะแน่น ทางเข้าคือการ์ดหน้าแรกทางเดียว

## M5 — หน้าแอดมิน `/admin/garbage`

`pages/admin/garbage.jsx` บางแบบ `pages/admin/smart-waste.jsx` (103 บรรทัด) ครอบด้วย `<PermissionGuard>` · ดึงข้อมูลด้วย `useEffect` + `useCallback` + `fetch` (รีโปนี้ไม่มี SWR) · error ขึ้นด้วย `Swal` ตาม smart-waste

- `components/garbage/admin/WeekScheduleView.jsx` — `PillTabs` 7 วัน (เรียง อา.–ส. คงที่, วันที่ไม่มีข้อมูลมีป้าย "รอข้อมูล" บนแท็บ) → ตารางงานมอบหมายของวันที่เลือก: เบอร์รถ, รอบ, สาย, ช่วงเวลา, จำนวนจุด, ป้าย `kind`, ป้ายเตือน "รอตรวจสอบ" เมื่อ `routeNeedsVerification`
- คลิกแถวกางดูรายการจุดพร้อมเวลา (accordion ไม่ใช่ modal)
- responsive dual-view (การ์ดบนมือถือ / table บนจอใหญ่ + sticky column แรก) ตาม `components/smart-waste/admin/MonthTable.jsx`
- การ์ด "ตั้งค่าการแสดงผล" ท้ายหน้า: ฟอร์มเบอร์ติดต่อ + หมายเหตุ → `PUT /api/garbage/settings`

### ลงทะเบียน 5 จุด (ไม่ใช่ 4 — `ADMIN_META` ไม่อยู่ใน skill)

1. `lib/permissions.ts` → `ALL_PAGES`: `{ path: '/admin/garbage', label: 'ตารางเดินรถเก็บขยะ', icon: '🚛', description: '…(กองสาธารณสุข)', category: 'management' }`
2. `lib/permissions.ts` → `DEFAULT_PERMISSIONS.admin`: เพิ่ม `/admin/garbage` (กองสาธารณสุขชุดเดียวกับ smart-waste ที่อยู่ใน baseline แล้ว) · `superadmin` ได้อัตโนมัติจาก `ALL_PAGES.map()`
3. `components/LayoutAdmin.tsx` → `navigationItems`: `{ label: 'ตารางเดินรถเก็บขยะ', href: '/admin/garbage', icon: '🚛', group: 'จัดการ' }` — hardcode แยกจาก `ALL_PAGES` ลืมแล้วเมนูไม่ขึ้นทั้งที่สิทธิ์ถูก
4. `components/Layout.js` → `ADMIN_META['/admin/garbage']`: `{ title, subtitle }` — ลืมแล้วหน้าไม่มีชื่อแบบเงียบ ๆ (`ADMIN_META[router.pathname] || {}`) · **ไม่ใช้** `fullBleed`
5. `scripts/grant-garbage-permission.js` — clone `scripts/grant-smart-waste-permission.js` แบบใหม่: `--yes` จึงเขียนจริง, ไม่ใส่แฟล็ก = dry-run + `console.table`, ใช้ `$addToSet` จึง idempotent, targets = user ที่มี `allowedPages` ไม่ว่าง

เอกสารบังคับตาม convention: `docs/modules/garbage.md` + แถวใน `docs/modules/README.md`

## Theme: สกัดเป็น `components/ui/adminTheme`

`components/smart-waste/wasteTheme.jsx` เขียนคอมเมนต์ไว้เองว่า "ถ้ามีโมดูลที่ 3 มายืมอีก ให้สกัดเป็น `components/ui/adminTheme`" — garbage คือรายที่ 3 พอดี

- ย้าย implementation จริงจาก `components/smart-school/adminTheme.jsx` → `components/ui/adminTheme.jsx`
- เปลี่ยน `components/smart-school/adminTheme.jsx` และ `components/smart-waste/wasteTheme.jsx` เป็น re-export shim บาง ๆ พร้อมคอมเมนต์ชี้ไปที่บ้านใหม่ → **ไฟล์ของ smart-school และ smart-waste ไม่ต้องแก้ import แม้แต่ไฟล์เดียว** ความเสี่ยงเป็นศูนย์
- garbage import จาก `components/ui/adminTheme` โดยตรง
- ตรวจว่าไม่พังด้วย `npm run build` (หน้า smart-waste/smart-school ต้องคอมไพล์ผ่าน)

ไม่ย้ายหรือแก้อย่างอื่นในสองโมดูลนั้น

## Error handling

- **API ชุดนี้คืน `{ error: string }` ไม่ใช่ `{ success, message }`** ต่างจากโมดูลอื่นในรีโป (elderly-school, activities, smart-papar) — handler ต้องอ่าน `json.error` ไม่งั้นข้อความ error จะเป็น undefined
- หน้าประชาชนใช้แถบสีแบบ `pages/elderly/checkin.tsx` (`rounded-3xl ring-1 p-4`): amber = ผิดพลาด, sky = ข้อมูลเสริม · ไม่ใช้ DaisyUI `alert` (เป็น idiom ฝั่งแอดมิน)
- ค้นไม่เจอ = ข้อความแนะนำ ("ไม่พบ … ลองพิมพ์ชื่อถนนหรือชุมชนสั้นลง") ไม่ใช่ error
- **live poll ล้มเหลวให้คงข้อมูลเดิมไว้** พร้อมเวลาอัปเดตล่าสุด ห้ามล้างจอเป็นว่าง (ชาวบ้านกำลังดูอยู่)
- `PUT /api/garbage/settings` ต้องตอบ 401/403 แยกกันได้ และหน้าแอดมินแสดงข้อความต่างกัน

## การทดสอบ

รีโปนี้เทสได้เฉพาะ logic ล้วน (vitest environment `node`, ไม่มีเทส React/API) จึงแยกชัด:

**เทสอัตโนมัติ (`lib/garbage/resolve.test.ts`)** — `buildWeekSchedule`: คืนครบ 7 วันเรียง weekday 0–6, วันว่างมี `assignments: []` ไม่หายไป, `routeNeedsVerification` map ถูกทั้ง true/false/undefined, anchor date วันไหนในสัปดาห์ก็ได้ช่วงวันเดียวกัน, ข้อมูลข้ามวันไม่รวบกันผิด (กัน regression ของ `pickLatestVersions`)

**ตรวจด้วยมือบน dev server** — ค้น "มาลัย" เจอผลจัดกลุ่มตามวัน · แถบ info ระบุพุธ–อาทิตย์รอข้อมูล · การ์ดหน้าแรกกดไป `/garbage` · `/admin/garbage` เปิดได้และแท็บ 7 วันครบ · ป้าย "รอตรวจสอบ" ขึ้นที่ R5–R7 · แก้เบอร์ติดต่อแล้วหน้าประชาชนเห็น · เมนูขึ้นไซด์บาร์ · `/admin/garbage` เข้าได้ทั้ง superadmin และ user ที่มี custom `allowedPages` หลังรัน grant script · `PUT /api/garbage/settings` โดยไม่ล็อกอิน = 401

**เกตปิดท้าย:** `npm test && npx tsc --noEmit && npm run build`

## Branch

M4–M5 ต้องใช้โค้ด M1–M3 ที่ยังอยู่ใน PR #116 (ไม่ merge) → แตก branch ใหม่ `feat/garbage-ui` **จาก `feat/garbage-schedule`** (stacked) · ตอนเปิด PR: ถ้า #116 merge เข้า main แล้วให้ตั้ง base เป็น main ถ้ายังไม่ merge ให้ตั้ง base เป็น `feat/garbage-schedule`

## สิ่งที่ไม่ทำในรอบนี้ (YAGNI)

แก้ตาราง/assignment จาก UI · แผนที่เส้นทาง (ต้องผูก `RouteStop.roadId` กับ collection `roads` ก่อน = M6) · export โปสเตอร์ (M7) · audit log ของการแก้ค่าตั้งค่า (มีแค่ `updatedBy`) · เพิ่ม `/garbage` ใน BottomNav · แจ้งเตือน LINE ก่อนรถมาถึง
