// อัปโหลดรูปเข้า Cloudinary (unsigned preset) — คืน secure_url
// โยน Error เมื่อไม่สำเร็จ ให้ผู้เรียกตัดสินใจ (flow สำรวจ: ถามผู้ใช้ว่าบันทึกต่อโดยไม่มีรูปไหม)
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  const data = await res.json();
  if (!data.secure_url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  return data.secure_url;
}
