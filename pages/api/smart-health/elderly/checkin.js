// shim ชั่วคราวหนึ่ง release: กัน tab /elderly/checkin ที่เปิดค้างช่วง deploy
// endpoint จริงย้ายไป /api/elderly-school/checkin แล้ว — ลบ shim นี้ในเฟสถัดไป
export { default } from "../../elderly-school/checkin";
