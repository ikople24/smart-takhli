// components/flood-relief/admin/zoneApi.ts — เรียก API โซน (superadmin) + แจ้ง error เป็นภาษาไทย
import Swal from "sweetalert2";

export async function zoneRequest(method: "POST" | "PATCH" | "DELETE", id: string | null, body?: unknown) {
  try {
    const res = await fetch(`/api/flood-relief/zones${id ? `/${id}` : ""}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error || "บันทึกโซนไม่สำเร็จ");
    return j as { id?: string; name?: string; reassigned?: number };
  } catch (e) {
    await Swal.fire({ icon: "error", title: "บันทึกโซนไม่สำเร็จ", text: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
