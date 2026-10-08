// ย่อรูป Cloudinary ตอนแสดงผลด้วย URL transformation (รูปหัวโบล์ต้นฉบับใหญ่ ~5 MB)
// URL ที่ไม่ใช่ Cloudinary คืนค่าเดิม
export function cloudinaryThumb(url, width = 400) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url || "";
  return url.replace("/upload/", `/upload/c_limit,w_${width},f_auto,q_auto/`);
}
