// คำค้นมาจากผู้ใช้ → ต้อง escape ก่อนสร้าง RegExp เสมอ ไม่งั้น "." "*" จะ match มั่ว
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
