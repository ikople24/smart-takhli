export async function uploadToCloudinary(file) {
  const resized = await resizeImage(file);

  const formData = new FormData();
  formData.append("file", resized);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();
  return data.secure_url;
}

// ฟังก์ชันช่วยปรับขนาดภาพก่อนอัปโหลด
// ย่อไม่ได้ (เบราว์เซอร์อ่านไฟล์ไม่ได้ เช่น HEIC จากอัลบั้มบางเครื่อง / เข้ารหัสกลับไม่ได้) → ส่งไฟล์เดิมให้ Cloudinary แปลงเอง
// เดิมไม่มี onerror → Promise ค้างตลอดไป ปุ่มส่งหมุนไม่จบ (เจอที่จุดวัดระดับน้ำ flood-relief 2026-09-26)
function resizeImage(file, maxWidth = 1024, maxHeight = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(file);
    img.onload = function () {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height *= maxWidth / width;
          width = maxWidth;
        } else {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const resizedFile = new File([blob], file.name, { type: file.type });
        resolve(resizedFile);
      }, file.type);
    };
    img.src = URL.createObjectURL(file);
  });
}