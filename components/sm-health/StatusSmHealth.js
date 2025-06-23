import Swal from 'sweetalert2';
export const updateStatus = async (id, currentStatus) => {
  const { value: status } = await Swal.fire({
    title: "แก้ไขสถานะ",
    input: "select",
    inputOptions: {
      "รับคำร้อง": "รับคำร้อง",
      "ประเมินโดยพยาบาลวิชาชีพ": "ประเมินโดยพยาบาลวิชาชีพ",
      "ลงทะเบียนอุปกรณ์": "ลงทะเบียนอุปกรณ์",
      "ส่งมอบอุปกรณ์": "ส่งมอบอุปกรณ์"
    },
    inputValue: currentStatus || "รับคำร้อง",
    showCancelButton: true
  });

  if (!status) return;

  try {
    const res = await fetch(`/api/smart-health/ob-registration?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      window.location.reload();
      Swal.fire("สำเร็จ", "อัปเดตสถานะแล้ว", "success");
    }
  } catch (err) {
    console.error("Update failed", err);
    Swal.fire("ผิดพลาด", "ไม่สามารถอัปเดตสถานะได้", "error");
  }
};

export const countStatuses = (data = []) => {
  const counts = {
    "รับคำร้อง": 0,
    "ประเมินโดยพยาบาลวิชาชีพ": 0,
    "ลงทะเบียนอุปกรณ์": 0,
    "ส่งมอบอุปกรณ์": 0,
  };

  data.forEach((item) => {
    if (counts[item.status] !== undefined) {
      counts[item.status]++;
    }
  });

  return counts;
};