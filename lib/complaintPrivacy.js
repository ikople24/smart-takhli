/**
 * จัดการเรื่องลับ / PDPA สำหรับข้อมูลร้องเรียน (ฝั่งเซิร์ฟเวอร์)
 */
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import Complaint from "@/models/Complaint";
import { applyDetailRedactions } from "@/lib/pdpaTextMask";

export {
  applyDetailRedactions,
  getMaskWordList,
  maskSensitiveWords,
} from "@/lib/pdpaTextMask";

const STAFF_ROLES = new Set(["admin", "superadmin"]);

const CLOUDINARY_MARKER = "/upload/";

/**
 * แปลง URL Cloudinary ให้เป็นภาพเบลอสำหรับผู้ใช้ทั่วไป (ไม่ใช่ URL ต้นฉบับ)
 */
export function toBlurredCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return url;
  const idx = url.indexOf(CLOUDINARY_MARKER);
  if (idx === -1) return null;
  const prefix = url.slice(0, idx + CLOUDINARY_MARKER.length);
  const rest = url.slice(idx + CLOUDINARY_MARKER.length);
  if (/^e_blur:|^e_pixelate:/.test(rest)) return url;
  return `${prefix}e_blur:1600,q_15,c_fill,w_1200,h_800/${rest}`;
}

export function toBlurredMediaUrl(url) {
  const blurred = toBlurredCloudinaryUrl(url);
  if (blurred) return blurred;
  return null;
}

export function blurUrlList(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => toBlurredMediaUrl(u)).filter(Boolean);
}

/**
 * ฟิลด์ assignment ที่เปิดเผยต่อผู้ใช้ทั่วไปได้ = รูปทรง schema เดิมก่อนขยายโมดูล tasks (2026-09) พอดี
 * ฟิลด์ใหม่เป็นข้อมูลภายในของเจ้าหน้าที่ ห้ามหลุดสาธารณะ: timeline (โน้ต/ชื่อคนบันทึก/เหตุผลโอน),
 * coordination (เลขหนังสือ/บันทึกติดตาม), blocked (เลขเสนอจัดซื้อ), transferRequest, dueDate, slaPaused*, stage, role
 */
const PUBLIC_ASSIGNMENT_FIELDS = [
  "_id",
  "complaintId",
  "userId",
  "assignedAt",
  "completedAt",
  "solution",
  "solutionImages",
  "note",
];

export function pickPublicAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") return assignment;
  const out = {};
  for (const key of PUBLIC_ASSIGNMENT_FIELDS) {
    if (key in assignment) out[key] = assignment[key];
  }
  return out;
}

export async function isComplaintStaffFromRequest(req) {
  const { userId } = getAuth(req);
  if (!userId) return false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = user.publicMetadata?.role;
    return STAFF_ROLES.has(role);
  } catch {
    return false;
  }
}

/**
 * โหลดแผนที่ complaintId -> pdpaSensitive สำหรับ sanitize assignments
 */
export async function getPdpaMapByComplaintIds(complaintIds) {
  const ids = [...new Set((complaintIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await Complaint.find(
    { _id: { $in: ids } },
    { pdpaSensitive: 1 }
  ).lean();
  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), !!row.pdpaSensitive);
  }
  return map;
}

export function sanitizeComplaintDocForResponse(doc, isStaff) {
  if (!doc) return doc;
  const plain =
    typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : { ...doc };

  if (isStaff) {
    delete plain.pdpaPublicSanitized;
    return plain;
  }

  if (plain.isConfidential) {
    return null;
  }

  if (plain.pdpaSensitive) {
    plain.pdpaPublicSanitized = true;
    plain.images = blurUrlList(plain.images || []);
    // ข้อความ: ใช้ช่วงที่เจ้าหน้าที่กำหนดเท่านั้น (ไม่เซ็นเซอร์อัตโนมัติ)
    plain.detail = applyDetailRedactions(
      plain.detail || "",
      plain.pdpaDetailRedactions || []
    );
    delete plain.pdpaDetailRedactions;
  }

  return plain;
}

export function sanitizeAssignmentsLean(assignments, isStaff, pdpaByComplaintId) {
  if (isStaff || !Array.isArray(assignments)) return assignments;
  return assignments.map((a) => {
    // ผู้ใช้ทั่วไปเห็นเฉพาะฟิลด์สาธารณะเสมอ (ไม่ใช่แค่เรื่อง PDPA) — กัน timeline/coordination ภายในหลุดทาง API
    const copy = pickPublicAssignment(a);
    const id = a?.complaintId != null ? String(a.complaintId) : "";
    if (id && pdpaByComplaintId.get(id)) {
      copy.solutionImages = blurUrlList(copy.solutionImages || []);
    }
    return copy;
  });
}

export function sanitizeAssignmentsMap(assignmentsMap, isStaff, pdpaByComplaintId) {
  if (isStaff || !assignmentsMap || typeof assignmentsMap !== "object") return assignmentsMap;
  const out = { ...assignmentsMap };
  for (const key of Object.keys(out)) {
    const a = out[key];
    if (!a) continue;
    const copy = pickPublicAssignment(a);
    const id = a.complaintId != null ? String(a.complaintId) : String(key);
    if (pdpaByComplaintId.get(id)) {
      copy.solutionImages = blurUrlList(copy.solutionImages || []);
    }
    out[key] = copy;
  }
  return out;
}
