# การแก้ไขปัญหา CardAssignment Component

## ปัญหาที่พบ
ใน `CardAssignment.js` component มีปัญหาเมื่อมีการกดรับเรื่องจากระบบ admin ข้อมูลเจ้าหน้าที่ที่แสดงผลเป็นคนเดียวกันหมด

## สาเหตุของปัญหา
1. Component ไม่ได้แสดงข้อมูลเจ้าหน้าที่ที่รับผิดชอบเรื่องนั้นๆ จริง
2. มีแต่การแสดง `adminOptions` ซึ่งเป็นตัวเลือกการดำเนินการทั่วไป
3. ไม่มีการดึงข้อมูลเจ้าหน้าที่จาก `userId` ใน assignment

## การแก้ไขที่ทำ

### 1. เพิ่มการแสดงข้อมูลเจ้าหน้าที่ที่รับผิดชอบ
- เพิ่ม state `assignedUser` สำหรับเก็บข้อมูลเจ้าหน้าที่
- เพิ่ม useEffect สำหรับดึงข้อมูลเจ้าหน้าที่จาก `assignment.userId`

### 2. สร้าง API Endpoint ใหม่
- สร้าง `/api/users/get-by-id.js` สำหรับดึงข้อมูล user จาก ObjectId
- สร้าง `/api/users/get-all-users-local.js` สำหรับดึงข้อมูล user ทั้งหมดจาก database

### 3. ปรับปรุง UI
- เพิ่ม section "เจ้าหน้าที่รับผิดชอบ" ที่แสดง:
  - รูปโปรไฟล์เจ้าหน้าที่ (รองรับ profileUrl และ profileImage)
  - Fallback icon เมื่อรูปภาพไม่สามารถโหลดได้
  - ชื่อเจ้าหน้าที่
  - ตำแหน่ง
  - แผนก
  - วันที่รับเรื่อง
  - วันที่เสร็จสิ้น (ถ้ามี)

### 4. เพิ่มการ Debug และ Error Handling
- เพิ่ม console.log เพื่อติดตามการดึงข้อมูล
- เพิ่มการตรวจสอบ URL รูปภาพและ domain ที่อนุญาต
- เพิ่ม fallback icon เมื่อรูปภาพไม่สามารถโหลดได้
- แสดงข้อความที่เหมาะสมเมื่อไม่พบข้อมูลเจ้าหน้าที่

## โครงสร้างข้อมูลที่ใช้

### Assignment Model
```javascript
{
  complaintId: ObjectId,
  userId: ObjectId, // ID ของเจ้าหน้าที่ที่รับผิดชอบ
  assignedAt: Date,
  solution: [String],
  solutionImages: [String],
  completedAt: Date,
  note: String
}
```

### User Model
```javascript
{
  name: String,
  position: String,
  department: String,
  role: String,
  phone: String,
  profileImage: String,
  assignedTask: String,
  clerkId: String,
  isActive: Boolean,
  isArchived: Boolean
}
```

## วิธีการใช้งาน
1. เมื่อ admin กดรับเรื่อง ระบบจะสร้าง assignment ใหม่พร้อม `userId`
2. `CardAssignment` component จะดึงข้อมูล assignment จาก API
3. จากนั้นจะดึงข้อมูลเจ้าหน้าที่จาก `userId` ที่ได้
4. แสดงข้อมูลเจ้าหน้าที่ที่รับผิดชอบในส่วนบนของ card

## การทดสอบ
1. ตรวจสอบ console.log เพื่อดูข้อมูลที่ดึงมา
2. ตรวจสอบว่าเจ้าหน้าที่ที่แสดงเป็นคนที่ถูกต้อง
3. ตรวจสอบว่าเมื่อมี assignment หลายรายการ เจ้าหน้าที่ที่แสดงจะแตกต่างกัน

## หมายเหตุ
- ต้องแน่ใจว่าข้อมูล user ใน database มีครบถ้วน
- หากไม่พบข้อมูลเจ้าหน้าที่ จะแสดงข้อความ "ไม่พบข้อมูลเจ้าหน้าที่ที่รับผิดชอบ"
- การแสดงผลจะใช้รูปโปรไฟล์จาก `profileUrl` หรือ `profileImage` หรือ fallback icon หากไม่มี
- รองรับการแสดงรูปภาพจาก domains ที่อนุญาตใน Next.js config
- ไม่แสดงเบอร์โทรเจ้าหน้าที่ตามความต้องการ 