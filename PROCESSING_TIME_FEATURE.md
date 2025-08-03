# ฟีเจอร์แสดงเวลาการประมวลผล

## วัตถุประสงค์
แทนที่การแสดงสถานะ "ดำเนินการเสร็จสิ้น" ด้วยการแสดงเวลาการประมวลผลที่ชัดเจนขึ้น เพื่อให้ผู้ใช้ทราบว่าเรื่องร้องเรียนได้รับการดำเนินการเร็วหรือช้าเพียงใด

## การคำนวณเวลาการประมวลผล

### ช่วงเวลาที่กำหนด
1. **ภายใน 24 ชม** - สีเขียว (เร็วมาก)
2. **ภายใน 2 วัน** - สีน้ำเงิน (เร็ว)
3. **ภายใน 7 วัน** - สีเหลือง (ปานกลาง)
4. **ภายใน 15 วัน** - สีส้ม (ช้า)
5. **เกิน 15 วัน** - สีแดง (ช้ามาก)

### สูตรการคำนวณ
```javascript
const assigned = new Date(assignedDate);
const completed = new Date(completedDate);
const diffTime = completed - assigned;
const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
```

## การแสดงผล

### 1. Badge แสดงช่วงเวลา
```jsx
<div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${color} ${bgColor} ${borderColor} border`}>
  <Zap className="w-3 h-3" />
  {text}
</div>
```

### 2. รายละเอียดเวลาการประมวลผล
```jsx
<div className="mt-2 text-xs text-gray-600">
  <span className="font-medium">เวลาการประมวลผล: </span>
  {calculatedTime}
</div>
```

## โทนสีที่ใช้

### ภายใน 24 ชม (เร็วมาก)
- **Text**: `text-green-600`
- **Background**: `bg-green-100`
- **Border**: `border-green-300`

### ภายใน 2 วัน (เร็ว)
- **Text**: `text-blue-600`
- **Background**: `bg-blue-100`
- **Border**: `border-blue-300`

### ภายใน 7 วัน (ปานกลาง)
- **Text**: `text-yellow-600`
- **Background**: `bg-yellow-100`
- **Border**: `border-yellow-300`

### ภายใน 15 วัน (ช้า)
- **Text**: `text-orange-600`
- **Background**: `bg-orange-100`
- **Border**: `border-orange-300`

### เกิน 15 วัน (ช้ามาก)
- **Text**: `text-red-600`
- **Background**: `bg-red-100`
- **Border**: `border-red-300`

## ฟังก์ชันที่เพิ่ม

### calculateProcessingTime(assignedDate, completedDate)
```javascript
const calculateProcessingTime = (assignedDate, completedDate) => {
  if (!assignedDate || !completedDate) return null;
  
  const assigned = new Date(assignedDate);
  const completed = new Date(completedDate);
  const diffTime = completed - assigned;
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffHours <= 24) {
    return { 
      text: "ภายใน 24 ชม", 
      color: "text-green-600", 
      bgColor: "bg-green-100", 
      borderColor: "border-green-300" 
    };
  }
  // ... other conditions
};
```

## การ Debug

### Console Log
```javascript
console.log("⏱️ Processing time calculation:", {
  assigned: assigned.toLocaleString('th-TH'),
  completed: completed.toLocaleString('th-TH'),
  diffHours,
  diffDays
});
```

## ตัวอย่างการแสดงผล

### กรณีที่ 1: ภายใน 24 ชม
```
⚡ ภายใน 24 ชม
เวลาการประมวลผล: 18 ชั่วโมง
```

### กรณีที่ 2: ภายใน 2 วัน
```
⚡ ภายใน 2 วัน
เวลาการประมวลผล: 2 วัน
```

### กรณีที่ 3: เกิน 15 วัน
```
⚡ เกิน 15 วัน
เวลาการประมวลผล: 20 วัน
```

## ข้อดีของฟีเจอร์นี้

### ✅ สำหรับผู้ใช้
- เห็นความเร็วในการดำเนินการได้ชัดเจน
- เข้าใจประสิทธิภาพการทำงานของระบบ
- สามารถเปรียบเทียบระหว่างเรื่องร้องเรียนต่างๆ ได้

### ✅ สำหรับเจ้าหน้าที่
- เห็นประสิทธิภาพการทำงานของตนเอง
- ตั้งเป้าหมายการทำงานได้ชัดเจน
- ปรับปรุงการทำงานได้ตรงจุด

### ✅ สำหรับระบบ
- มีข้อมูลสำหรับการวิเคราะห์ประสิทธิภาพ
- สามารถติดตาม KPI ได้
- พัฒนาระบบได้ตรงตามความต้องการ

## การทดสอบ

1. **ทดสอบการคำนวณ**
   - ตรวจสอบ console.log เพื่อดูการคำนวณ
   - ตรวจสอบว่าช่วงเวลาถูกต้อง

2. **ทดสอบการแสดงผล**
   - ตรวจสอบสีที่แสดงถูกต้องตามช่วงเวลา
   - ตรวจสอบข้อความที่แสดง

3. **ทดสอบกรณีพิเศษ**
   - กรณีไม่มีวันที่เสร็จสิ้น
   - กรณีวันที่ไม่ถูกต้อง

## หมายเหตุ
- การคำนวณใช้ `Math.ceil()` เพื่อปัดขึ้น
- เวลาจะแสดงเป็นชั่วโมงถ้าน้อยกว่า 24 ชั่วโมง
- เวลาจะแสดงเป็นวันถ้ามากกว่าหรือเท่ากับ 24 ชั่วโมง
- หากไม่มีวันที่เสร็จสิ้น จะไม่แสดงเวลาการประมวลผล 