# ประเมินความพึงพอใจ (satisfaction)

แบบประเมินความพึงพอใจการใช้บริการ — ลิงก์จากระบบร้องเรียนหลังปิดเรื่อง

## หน้า

- `/user/satisfaction` (hideFromMenu — เข้าผ่าน internal link)
- หน้าวิเคราะห์: `/admin/feedback-analysis` (⚠️ ยังพัง — hideFromMenu ไว้)

## API / Model

- `pages/api/satisfaction/*` (รวม `[id].js`)
- `models/Satisfaction.js`

## Components (⚠️ ยังอยู่ root — รอเฟส 5)

`SatisfactionForm.js`, `SatisfactionChart.js`, `SatisfactionCommentsPanel.js`

## หมายเหตุ

โมดูลนี้อาจถูกใช้เป็นแหล่งคะแนนของ**ฟีดกิจกรรม** (roadmap เฟส 2) —
ตัดสินใจตอน brainstorm ว่าจะใช้ `Satisfaction` หรือ `StudentFeedback` ต่อกิจกรรม
