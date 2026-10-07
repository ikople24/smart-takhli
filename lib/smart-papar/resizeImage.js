// ย่อรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด (ด้านยาว ≤ maxDim, JPEG) — ใช้ได้เฉพาะฝั่ง client
// ย่อไม่ได้/ช้าเกิน (เช่นไฟล์ที่เบราว์เซอร์ถอดรหัสไม่ได้) → คืนไฟล์เดิม ไม่ให้ค้าง
export function resizeImage(file, { maxDim = 1600, quality = 0.82, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (out) => {
      if (done) return;
      done = true;
      resolve(out);
    };
    const timer = setTimeout(() => finish(file), timeoutMs);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            clearTimeout(timer);
            finish(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file);
          },
          "image/jpeg",
          quality
        );
      } catch {
        clearTimeout(timer);
        finish(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      clearTimeout(timer);
      finish(file);
    };
    img.src = url;
  });
}
