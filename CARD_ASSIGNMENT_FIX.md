# การแก้ไขปัญหาเจ้าหน้าที่ที่รับเรื่องเป็นคนเดียวกันหมด

## 🔍 **ปัญหาที่พบ:**

เจ้าหน้าที่ที่รับผิดชอบเรื่องร้องเรียนแสดงเป็นคนเดียวกันหมดทุกเรื่อง แม้ว่าในฐานข้อมูลจะมี assignment ที่แตกต่างกัน

## 🕵️ **สาเหตุของปัญหา:**

ในไฟล์ `components/CardOfficail.js` มีการใช้ `assignments[0]?.userId` ซึ่งหมายความว่าจะดึงข้อมูล user จาก assignment แรกเท่านั้น ไม่ใช่จาก assignment ที่ตรงกับ complaintId ที่ส่งมา

### โค้ดเดิมที่มีปัญหา:
```javascript
useEffect(() => {
  const fetchAssignedUser = async () => {
    if (assignments[0]?.userId) { // ❌ ใช้ assignment แรกเท่านั้น
      // ดึงข้อมูล user
    }
  };
  fetchAssignedUser();
}, [assignments]);
```

## 🛠️ **วิธีแก้ไข:**

### 1. แก้ไข `components/CardOfficail.js`

**การเปลี่ยนแปลง:**
- ย้ายการดึงข้อมูล user ไปอยู่ใน `fetchAssignments` function
- ใช้ข้อมูลจาก assignment ที่ตรงกับ complaintId ที่ส่งมา
- ลบ useEffect เดิมที่ดึง assignedUser ออก

**โค้ดที่แก้ไขแล้ว:**
```javascript
useEffect(() => {
  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/assignments");
      const data = await res.json();
      setAssignments(data);
      if (props.probId) {
        const responsibleAssignments = data.filter(
          assignment => assignment.complaintId === props.probId
        );
        if (responsibleAssignments.length > 0) {
          setAssignedDate(responsibleAssignments[0].assignedAt);
          setCompletedDate(responsibleAssignments[0].completedAt);
          // ✅ ดึงข้อมูล user จาก assignment ที่ตรงกับ complaintId
          if (responsibleAssignments[0].userId) {
            try {
              const userRes = await fetch(`/api/users/get-by-id?userId=${responsibleAssignments[0].userId}`);
              const userData = await userRes.json();
              if (userData.success && userData.user) {
                setAssignedUser(userData.user);
              }
            } catch (error) {
              console.error("Failed to fetch assigned user:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  fetchAssignments();
  fetchComplaintStatus();
}, [props.probId]);
```

## ✅ **ผลลัพธ์ที่คาดหวัง:**

หลังจากแก้ไขแล้ว:
1. เจ้าหน้าที่ที่รับผิดชอบจะแสดงข้อมูลที่ถูกต้องตาม assignment ของแต่ละเรื่อง
2. ข้อมูลจะมาจากตาราง `users` ผ่าน API `/api/users/get-by-id`
3. แต่ละเรื่องจะมีเจ้าหน้าที่รับผิดชอบที่แตกต่างกันตามที่กำหนดใน assignment

## 🔧 **การทดสอบ:**

1. เปิดแอปพลิเคชัน
2. ไปที่หน้าแสดงรายละเอียดเรื่องร้องเรียน
3. ตรวจสอบว่าเจ้าหน้าที่ที่รับผิดชอบแสดงข้อมูลที่ถูกต้องและแตกต่างกันตามแต่ละเรื่อง

## 📝 **หมายเหตุ:**

- การแก้ไขนี้ไม่กระทบต่อการทำงานอื่นๆ ของระบบ
- ข้อมูล assignment และ user ยังคงถูกต้องในฐานข้อมูล
- เพียงแต่การแสดงผลในส่วน UI เท่านั้นที่ได้รับการแก้ไข 