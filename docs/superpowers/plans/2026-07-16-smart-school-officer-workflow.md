# Smart School Officer Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้ 3 ปัญหาการใช้งานจริงของ smart-school (ผู้กรอกส่วนใหญ่คือเจ้าหน้าที่): รูปขยะ/รูปเดิมถูกทับ, ตาราง admin ไม่แสดงเลขบัตร, ฟอร์ม public มีฟิลด์ไม่ครบ

**Architecture:** งานแยกกัน 3 ก้อน ทำเรียงได้อิสระ — (1) แก้ prefill/submit เรื่องรูป (2) เพิ่มคอลัมน์+ตัวกรองเลขบัตรในตาราง admin (ข้อมูลมีอยู่แล้ว ไม่แตะ API) (3) ติ๊ก "โหมดเต็ม" เพิ่ม 7 ฟิลด์ในฟอร์ม public + prefill/submit รองรับ

**Tech Stack:** Next.js 15 Pages Router, React 19, Mongoose, Zod, Tailwind+DaisyUI. **ไม่มี test runner** → verify ทุก task ด้วย `npm run lint` (expect "✔ No ESLint warnings or errors") + `npm run build` (expect exit 0 + "Compiled successfully"; warning `@clerk/nextjs useContext` เป็นของเดิม ไม่ใช่ปัญหา; ถ้าเจอ `PageNotFoundError` ตอน collecting page data ให้ `rm -rf .next` แล้ว build ใหม่ — เป็น flaky ของ Next build worker)

**Spec:** `docs/superpowers/specs/2026-07-16-smart-school-officer-workflow-design.md`

---

## File Structure

| ไฟล์ | ความรับผิดชอบ | Task |
|---|---|---|
| `components/smart-school/admin/ApplicationTable.jsx` | คอลัมน์ + ตัวกรองเลขบัตร | 1 |
| `pages/api/smart-school/prefill.js` | คืน `imageUrl` (+7 ฟิลด์ใน Task 3) | 2, 3 |
| `pages/api/smart-school/submit.js` | คงรูปเดิมถ้าไม่อัปใหม่ (+รับ 7 ฟิลด์ใน Task 3) | 2, 3 |
| `components/smart-school/survey/SchoolSurveyModal.jsx` | prefill รูป (+EMPTY_FORM/payload/fullMode ใน Task 3) | 2, 3 |
| `models/smart-school/SchoolApplication.js` | export `FAMILY_STATUS_OPTIONS` (DRY) | 3 |
| `components/smart-school/survey/InfoStep.jsx` | toggle "โหมดเต็ม" + 7 ฟิลด์ | 3 |

**ไม่แตะ:** `MediaStep.jsx`/`PhotoSlots.jsx` (รองรับรูปเดิมอยู่แล้ว), `citizen-id.js`, `update.js`, `list.js`, permissions

---

## Task 1: ตาราง admin — คอลัมน์ + ตัวกรองเลขบัตร

**Files:** Modify: `components/smart-school/admin/ApplicationTable.jsx`

**บริบท:** `list.js:52-61` ส่ง `hasCitizenId` (boolean) และ `citizenIdMasked` (string|null) มาให้ในทุกแถวอยู่แล้ว — ตารางแค่ไม่เคยเอามาใช้ **ห้ามแตะ API**

- [ ] **Step 1: เพิ่ม state ตัวกรอง**

หา `const [levelTab, setLevelTab] = useState('all');` แล้วเพิ่มบรรทัดถัดไป:
```jsx
  const [citizenFilter, setCitizenFilter] = useState('all'); // all | has | none
```

- [ ] **Step 2: ใส่เงื่อนไขกรองใน useMemo `filtered`**

`filtered` เป็น `rows.filter((r) => { ...if-guard... })` — เพิ่ม 2 บรรทัดนี้ต่อจาก `if (renewalFilter === 'new' && r.isRenewal) return false;`:
```jsx
      if (citizenFilter === 'has' && !r.hasCitizenId) return false;
      if (citizenFilter === 'none' && r.hasCitizenId) return false;
```
และเปลี่ยน dependency array ของ `useMemo` จาก:
```jsx
  }, [rows, search, statusFilter, renewalFilter, levelTab]);
```
เป็น:
```jsx
  }, [rows, search, statusFilter, renewalFilter, levelTab, citizenFilter]);
```

- [ ] **Step 3: เพิ่ม select ตัวกรอง**

ต่อจาก `<select>` ตัวกรอง `renewalFilter` (ที่มี option "รายเก่า+ใหม่") เพิ่ม:
```jsx
        <select className="select select-bordered select-sm" value={citizenFilter}
          onChange={(e) => setCitizenFilter(e.target.value)}>
          <option value="all">เลขบัตร: ทั้งหมด</option>
          <option value="has">มีเลขบัตรแล้ว</option>
          <option value="none">ยังไม่มีเลขบัตร</option>
        </select>
```

- [ ] **Step 4: เพิ่มคอลัมน์ในหัวตาราง**

ใน `<thead>` เพิ่ม `<th>` ต่อจาก `<th className={tableHeadCls}>เบอร์โทร</th>`:
```jsx
                <th className={tableHeadCls}>เลขบัตร</th>
```

- [ ] **Step 5: เพิ่มเซลล์ในแถว**

ใน `<tbody>` เพิ่ม `<td>` ตรงตำแหน่งเดียวกัน (ต่อจากเซลล์เบอร์โทร `<td>{r.phone || '-'}</td>`):
```jsx
                  <td className="whitespace-nowrap">
                    {r.citizenIdMasked ? (
                      <span className="text-[12px] text-[#211B2E]">{r.citizenIdMasked}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F1F4] text-[#6B7280] font-bold">
                        ยังไม่มี
                      </span>
                    )}
                  </td>
```

- [ ] **Step 6: แก้ colSpan ของแถว "ไม่มีข้อมูล"**

หา `<tr><td colSpan={8} className="text-center text-gray-400 py-6">ไม่มีข้อมูล</td></tr>` แล้วเปลี่ยน `colSpan={8}` → `colSpan={9}` (เพิ่มมา 1 คอลัมน์)

- [ ] **Step 7: lint + build**

Run: `npm run lint && npm run build`
Expected: lint "✔ No ESLint warnings or errors"; build exit 0

- [ ] **Step 8: Commit**

```bash
git add components/smart-school/admin/ApplicationTable.jsx
git commit -m "feat(smart-school): ตาราง admin โชว์เลขบัตร + ตัวกรองมี/ยังไม่มี"
```

---

## Task 2: รูปภาพ — prefill คืนรูปเดิม + submit ไม่ทับ

**Files:**
- Modify: `pages/api/smart-school/prefill.js`
- Modify: `pages/api/smart-school/submit.js`
- Modify: `components/smart-school/survey/SchoolSurveyModal.jsx`

**บริบท:** 3 บั๊กซ้อนกัน — prefill ไม่คืน `imageUrl` → ฟอร์มรายเก่ารูปว่าง → zod/server บังคับ ≥1 → เจ้าหน้าที่อัปมั่ว → `submit.js` ทับรูปเดิม **`MediaStep`/`PhotoSlots` ไม่ต้องแก้** (รับ `value={formData.image}` แล้ว map URL ลงช่องเอง)

- [ ] **Step 1: prefill คืน imageUrl**

ใน `pages/api/smart-school/prefill.js` แก้บรรทัด `.select(...)` เป็น (เพิ่ม `imageUrl`):
```js
      .select("surveyYear educationLevel schoolName address note housingStatus householdMembers annualIncome residencyOverOneYear location imageUrl -_id")
```

- [ ] **Step 2: ฟอร์ม prefill รูปเดิมเข้า formData**

ใน `components/smart-school/survey/SchoolSurveyModal.jsx` ฟังก์ชัน `handleIdentityDone` เพิ่มบรรทัดนี้ใน object ที่ส่งให้ `setFormData` (ต่อจาก `residencyOverOneYear: prev.residencyOverOneYear ?? null,`):
```jsx
        image: Array.isArray(prev.imageUrl) ? prev.imageUrl : [],
```
> zod `image.min(1)` ไม่ต้องแก้ — มีรูปเดิมแล้วผ่านเอง; รายใหม่ยังต้องอัป ≥1 ตามเดิม

- [ ] **Step 3: submit — ย้ายการเช็ครูปออกจาก guard บนสุด**

ใน `pages/api/smart-school/submit.js` หา guard นี้:
```js
    if (!fullName || !Array.isArray(image) || image.length === 0 || !location?.lat) {
```
เปลี่ยนเป็น (ตัดเงื่อนไขรูปออก — จะไปเช็คทีหลังเมื่อรู้ว่าใบเดิมมีรูปไหม):
```js
    if (!fullName || !location?.lat) {
```
และในบรรทัด `required: [...]` ที่อยู่ใต้ guard นั้น เปลี่ยนเป็น:
```js
        required: ["fullName", "location.lat"],
```

- [ ] **Step 4: submit — ไม่ใส่ imageUrl ลง fields ตั้งแต่แรก**

ใน object `fields` ลบบรรทัดนี้ออก:
```js
      imageUrl: image.slice(0, 3),
```

- [ ] **Step 5: submit — เช็ค/ตั้งรูปหลังหา application เจอ**

หาโค้ดนี้:
```js
    let application = await SchoolApplication.findOne({
      applicantRef: applicant._id,
      surveyYear,
    });
    if (application) {
```
แทรกโค้ดนี้ **ก่อน** `if (application) {`:
```js
    // รูป: อัปใหม่ = ทับ; ไม่อัปใหม่ = คงรูปเดิมของใบนั้น (กันเจ้าหน้าที่ต้องอัปมั่วทุกครั้งที่เปิดแก้)
    const hasNewImages = Array.isArray(image) && image.length > 0;
    const hasExistingImages = (application?.imageUrl || []).length > 0;
    if (!hasNewImages && !hasExistingImages) {
      return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป" });
    }
    if (hasNewImages) fields.imageUrl = image.slice(0, 3);

```

- [ ] **Step 6: submit — notify ใช้รูปจริงที่บันทึก**

หาบล็อก `await notifySchoolEvent(...)` แล้วเปลี่ยนบรรทัด:
```js
      image: image.slice(0, 3),
```
เป็น (ใช้รูปที่อยู่บนใบจริงหลังบันทึก — กันกรณีไม่ได้อัปใหม่แล้วส่ง [] ไป n8n):
```js
      image: (application.imageUrl || []).slice(0, 3),
```

- [ ] **Step 7: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 8: Commit**

```bash
git add pages/api/smart-school/prefill.js pages/api/smart-school/submit.js components/smart-school/survey/SchoolSurveyModal.jsx
git commit -m "fix(smart-school): รายเก่าเห็นรูปเดิม + ยื่นซ้ำไม่ทับรูป (กันรูปขยะ)"
```

---

## Task 3: โหมดเต็ม — 7 ฟิลด์ในฟอร์ม public

**Files:**
- Modify: `models/smart-school/SchoolApplication.js`
- Modify: `pages/api/smart-school/prefill.js`
- Modify: `pages/api/smart-school/submit.js`
- Modify: `components/smart-school/survey/SchoolSurveyModal.jsx`
- Modify: `components/smart-school/survey/InfoStep.jsx`

**7 ฟิลด์:** `gradeLevel · gpa · actualAddress · familyStatus · incomeSource · receivedScholarship · takhliScholarshipHistory`
**ไม่รวม `citizenId`** (ตามสเปค: เลขบัตรกรอกเฉพาะหลังบ้าน — ฟอร์ม public เปิดสาธารณะ เสี่ยง PDPA)

- [ ] **Step 1: export FAMILY_STATUS_OPTIONS จาก model (DRY)**

ใน `models/smart-school/SchoolApplication.js` เหนือ `const SchoolApplicationSchema = ...` เพิ่ม:
```js
export const FAMILY_STATUS_OPTIONS = [
  "บิดา-มารดาแยกกันอยู่", "แยกกันอยู่ชั่วคราว", "หย่าร้าง",
  "บิดาส่งเสีย", "มารดาส่งเสีย", "บิดา/มารดาไม่ได้ส่งเสีย",
];
```
แล้วในสคีมา เปลี่ยน `familyStatus` ให้ใช้ค่าเดียวกัน:
```js
    familyStatus: {
      type: [String],
      enum: FAMILY_STATUS_OPTIONS,
      default: [],
    },
```

- [ ] **Step 2: prefill คืน 7 ฟิลด์**

ใน `pages/api/smart-school/prefill.js` แก้ `.select(...)` (ต่อจาก `imageUrl` ที่เพิ่มใน Task 2) เป็น:
```js
      .select("surveyYear educationLevel schoolName address note housingStatus householdMembers annualIncome residencyOverOneYear location imageUrl gradeLevel gpa actualAddress familyStatus incomeSource receivedScholarship takhliScholarshipHistory -_id")
```

- [ ] **Step 3: submit รับ 7 ฟิลด์**

ใน `pages/api/smart-school/submit.js` เปลี่ยนบรรทัด import เดิม (บรรทัดที่ 4):
```js
import SchoolApplication from "@/models/smart-school/SchoolApplication";
```
เป็น:
```js
import SchoolApplication, { FAMILY_STATUS_OPTIONS } from "@/models/smart-school/SchoolApplication";
```

ใน destructure `req.body` เพิ่ม 7 ฟิลด์:
```js
      residencyOverOneYear, image, location,
      gradeLevel, gpa, actualAddress, familyStatus,
      incomeSource, receivedScholarship, takhliScholarshipHistory,
```

ใน object `fields` เพิ่ม (ท้ายสุดก่อน `isRenewal,`):
```js
      gradeLevel: gradeLevel || "",
      gpa: gpa === "" || gpa === null || gpa === undefined || Number.isNaN(parseFloat(gpa))
        ? null
        : Math.min(4, Math.max(0, parseFloat(gpa))),
      actualAddress: actualAddress || "",
      // กรองตาม enum — ฟอร์มเปิดสาธารณะ ค่ามั่วจะทำ mongoose validation ล้ม 500
      familyStatus: Array.isArray(familyStatus)
        ? familyStatus.filter((v) => FAMILY_STATUS_OPTIONS.includes(v))
        : [],
      incomeSource: Array.isArray(incomeSource) ? incomeSource.slice(0, 20) : [],
      receivedScholarship: Array.isArray(receivedScholarship) ? receivedScholarship.slice(0, 20) : [],
      takhliScholarshipHistory: Array.isArray(takhliScholarshipHistory) ? takhliScholarshipHistory.slice(0, 20) : [],
```

- [ ] **Step 4: EMPTY_FORM + fullMode state**

ใน `components/smart-school/survey/SchoolSurveyModal.jsx` เพิ่ม 7 คีย์ใน `EMPTY_FORM` (ต่อจาก `residencyOverOneYear: null,`):
```jsx
  gradeLevel: '',
  gpa: '',
  actualAddress: '',
  familyStatus: [],
  incomeSourceText: '',
  receivedScholarshipText: '',
  takhliScholarshipHistoryText: '',
```
> 3 ฟิลด์ list เก็บเป็น **ข้อความคั่นด้วย ,** ในฟอร์ม แล้วแปลงเป็น array ตอนส่ง (แพตเทิร์นเดียวกับ `ApplicationEditModal`)

เพิ่ม state (ใกล้ `const [useCurrent, setUseCurrent] = useState(false);`):
```jsx
  const [fullMode, setFullMode] = useState(false); // ติ๊ก "กรอกแบบเต็ม" — เก็บที่นี่ให้ค้างข้ามสเต็ป
```
และใน `resetForm`/จุดที่มี `setUseCurrent(false);` เพิ่ม:
```jsx
    setFullMode(false);
```

- [ ] **Step 5: prefill 7 ฟิลด์เข้าฟอร์ม**

ใน `handleIdentityDone` เพิ่มใน object ที่ส่งให้ `setFormData` (ต่อจาก `image: ...` ที่เพิ่มใน Task 2):
```jsx
        gradeLevel: prev.gradeLevel || '',
        gpa: prev.gpa != null ? String(prev.gpa) : '',
        actualAddress: prev.actualAddress || '',
        familyStatus: Array.isArray(prev.familyStatus) ? prev.familyStatus : [],
        incomeSourceText: (prev.incomeSource || []).join(', '),
        receivedScholarshipText: (prev.receivedScholarship || []).join(', '),
        takhliScholarshipHistoryText: (prev.takhliScholarshipHistory || []).join(', '),
```

- [ ] **Step 6: ส่ง 7 ฟิลด์ใน payload**

ใน `handleSubmit` แก้ `body: JSON.stringify({...})` เพิ่มต่อจาก `annualIncome: parseInt(formData.annualIncome) || 0,`:
```jsx
          gpa: formData.gpa === '' ? null : parseFloat(formData.gpa),
          incomeSource: formData.incomeSourceText.split(',').map((x) => x.trim()).filter(Boolean),
          receivedScholarship: formData.receivedScholarshipText.split(',').map((x) => x.trim()).filter(Boolean),
          takhliScholarshipHistory: formData.takhliScholarshipHistoryText.split(',').map((x) => x.trim()).filter(Boolean),
```
> `gradeLevel`, `actualAddress`, `familyStatus` ไปกับ `...formData` อยู่แล้ว (ชื่อคีย์ตรงกับที่ submit รับ)

- [ ] **Step 7: InfoStep — รับ prop + toggle**

ใน `components/smart-school/survey/InfoStep.jsx` เปลี่ยน signature:
```jsx
export default function InfoStep({ formData, setFormData, prevApplication, prevYear, disabled, blockedSchools, fullMode, setFullMode }) {
```
เพิ่ม import (ต่อจาก import เดิม):
```jsx
import { FAMILY_STATUS_OPTIONS } from '@/models/smart-school/SchoolApplication';
```

- [ ] **Step 8: InfoStep — UI toggle + 7 ฟิลด์**

ก่อน `</div>` ปิดท้ายสุดของ component (หลัง `FieldRow n={10}` ทะเบียนบ้าน) เพิ่ม:
```jsx
      <label className="flex cursor-pointer items-center gap-2 rounded-[14px] bg-[#F6F3FD] px-3.5 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[#E7E2F2] accent-[#7C3AED]"
          checked={!!fullMode}
          disabled={disabled}
          onChange={(e) => setFullMode(e.target.checked)}
        />
        <span className="text-[12px] font-bold text-[#57506A]">กรอกแบบเต็ม (ทวนข้อมูล)</span>
      </label>

      {fullMode && (
        <>
          <FieldRow n={11} label="ระดับชั้น" hint={<PrevHint year={prevYear} value={prev.gradeLevel} />}>
            <input type="text" placeholder="เช่น ป.5 / ม.2" className={inputCls} disabled={disabled}
              value={formData.gradeLevel || ''} onChange={(e) => set({ gradeLevel: e.target.value })} />
          </FieldRow>

          <FieldRow n={12} label="เกรดเฉลี่ย (GPA)" hint={<PrevHint year={prevYear} value={prev.gpa} />}>
            <input type="number" step="0.01" min="0" max="4" placeholder="0.00–4.00" className={inputCls}
              disabled={disabled} value={formData.gpa ?? ''} onChange={(e) => set({ gpa: e.target.value })} />
          </FieldRow>

          <FieldRow n={13} label="ที่อยู่จริง (ถ้าต่างจากทะเบียนบ้าน)" hint={<PrevHint year={prevYear} value={prev.actualAddress} />}>
            <textarea placeholder="ที่อยู่ที่พักอาศัยจริง" className={inputCls} disabled={disabled}
              value={formData.actualAddress || ''} onChange={(e) => set({ actualAddress: e.target.value })} />
          </FieldRow>

          <FieldRow n={14} label="สถานะครอบครัว">
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_STATUS_OPTIONS.map((opt) => {
                const on = (formData.familyStatus || []).includes(opt);
                return (
                  <button key={opt} type="button" disabled={disabled} className={chipCls(on)}
                    onClick={() => set({
                      familyStatus: on
                        ? (formData.familyStatus || []).filter((v) => v !== opt)
                        : [...(formData.familyStatus || []), opt],
                    })}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow n={15} label="แหล่งรายได้ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.incomeSource || []).join(', ')} />}>
            <input type="text" placeholder="เช่น รับจ้าง, ค้าขาย" className={inputCls} disabled={disabled}
              value={formData.incomeSourceText || ''} onChange={(e) => set({ incomeSourceText: e.target.value })} />
          </FieldRow>

          <FieldRow n={16} label="ทุนอื่นที่ได้รับ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.receivedScholarship || []).join(', ')} />}>
            <input type="text" placeholder="เช่น กสศ., ทุนโรงเรียน" className={inputCls} disabled={disabled}
              value={formData.receivedScholarshipText || ''} onChange={(e) => set({ receivedScholarshipText: e.target.value })} />
          </FieldRow>

          <FieldRow n={17} label="ทุนเทศบาลที่เคยได้ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.takhliScholarshipHistory || []).join(', ')} />}>
            <input type="text" placeholder="เช่น 2567, 2568" className={inputCls} disabled={disabled}
              value={formData.takhliScholarshipHistoryText || ''} onChange={(e) => set({ takhliScholarshipHistoryText: e.target.value })} />
          </FieldRow>
        </>
      )}
```

- [ ] **Step 9: ส่ง prop จาก modal ไป InfoStep**

ใน `SchoolSurveyModal.jsx` หา `<InfoStep` แล้วเพิ่ม 2 prop:
```jsx
                fullMode={fullMode}
                setFullMode={setFullMode}
```

- [ ] **Step 10: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 11: Commit**

```bash
git add models/smart-school/SchoolApplication.js pages/api/smart-school/prefill.js pages/api/smart-school/submit.js components/smart-school/survey/SchoolSurveyModal.jsx components/smart-school/survey/InfoStep.jsx
git commit -m "feat(smart-school): โหมดเต็มในฟอร์ม public — เพิ่ม 7 ฟิลด์ (ไม่รวมเลขบัตร)"
```

---

## Final verification (หลังครบทุก task)

- [ ] `npm run lint` — clean
- [ ] `npm run build` — exit 0
- [ ] ตรวจว่า zod ไม่ได้บังคับฟิลด์ใหม่: `grep -n "gradeLevel\|gpa\|actualAddress" components/smart-school/survey/SchoolSurveyModal.jsx` — ต้อง **ไม่โผล่ใน `surveySchema`** (ฟิลด์เพิ่มเป็น optional โดยไม่ต้องประกาศใน zod)
- [ ] ตรวจว่าไม่มี `citizenId` ในฟอร์ม public: `grep -rn "citizenId" components/smart-school/survey/` — ต้องว่าง
- [ ] ตาดู dev server (ให้ผู้ใช้ยืนยัน): รายเก่า → **เห็นรูปเดิม + ส่งได้โดยไม่อัปใหม่** · ติ๊กโหมดเต็ม → เห็น 7 ฟิลด์พร้อมค่าเดิม · ตาราง admin → คอลัมน์เลขบัตร + กรองได้

## Notes / Constraints
- **ห้าม**เพิ่มช่องเลขบัตรในฟอร์ม public
- **ห้าม**แตะ `MediaStep.jsx`/`PhotoSlots.jsx` (รองรับอยู่แล้ว), `citizen-id.js`, `update.js`, `list.js`
- ยื่นซ้ำต้อง **ไม่ทับรูปเดิม** ถ้าไม่ได้อัปใหม่ — เป็นหัวใจของ Task 2
- ล้างรูปขยะเดิมใน Cloudinary = งานแยก ไม่อยู่ในแผนนี้
