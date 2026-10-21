// หน้าเดิม /admin/elderly-cards ย้ายเป็นแท็บ "cards" ใน /admin/elderly-school (2026-10)
// คง path ไว้ให้ลิงก์/บุ๊กมาร์กเดิมยังใช้ได้ — ส่งต่อพร้อม yearBE
export async function getServerSideProps({ query }) {
  const qs = new URLSearchParams({ tab: "cards" });
  const yearBE = Array.isArray(query.yearBE) ? query.yearBE[0] : query.yearBE;
  if (yearBE) qs.set("yearBE", String(yearBE));
  return { redirect: { destination: `/admin/elderly-school?${qs.toString()}`, permanent: false } };
}

export default function Redirect() {
  return null;
}
