import { describe, it, expect } from "vitest";
import {
  buildWorklistItem,
  identifyFields,
  ownerFields,
  OWNER_FIELD_COLS,
  type WorklistTxnInput,
} from "./buildWorklistItem";
import { PARCEL_PAYLOAD } from "./__fixtures__/parcelPayload";

function txn(over: Partial<WorklistTxnInput> = {}): WorklistTxnInput {
  return {
    _id: "txn1",
    recordKey: "5039|2|4682|07|1000|84",
    deedNo: "31635",
    changeType: "TRANSFER",
    txnDate: new Date("2026-01-05"),
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    payloadRaw: PARCEL_PAYLOAD,
    ...over,
  };
}

// helper: ดึงค่า step ตาม label (เทสไม่ผูกกับลำดับ)
function val(steps: { label: string; value: string }[], label: string) {
  return steps.find((s) => s.label === label)?.value;
}

describe("buildWorklistItem", () => {
  it("TRANSFER -> REPLACE_OWNER with new owner + raw id + address from payloadRaw", () => {
    const item = buildWorklistItem(txn(), "นาย ก ข", "2569-01");
    expect(item.changeType).toBe("TRANSFER");
    expect(item.action).toBe("REPLACE_OWNER");
    expect(item.search).toEqual({ deedNo: "31635", oldOwnerName: "นาย ก ข" });
    expect(val(item.steps, "ชื่อ")).toBe("วรารีย์");
    expect(val(item.steps, "นามสกุล")).toBe("ชาลีรัตน์");
    expect(val(item.steps, "เลขประจำตัวประชาชน")).toBe("1609700018248"); // เลขล้วน (ตรง LTAX)
    expect(val(item.steps, "ตำบล")).toBe("ตาคลี");
    // มี step ลบเจ้าของเดิม และเป็น instruction (copy ไม่ได้)
    expect(item.steps.some((s) => s.label.includes("ลบเจ้าของเดิม"))).toBe(true);
    expect(item.steps.find((s) => s.label.includes("ลบเจ้าของเดิม"))?.copyable).toBe(false);
    // copy ได้เฉพาะช่องค่า ไม่ใช่ instruction
    expect(item.steps.find((s) => s.label === "ชื่อ")?.copyable).toBe(true);
  });

  it("oldOwnerName null when no prevOwner", () => {
    const item = buildWorklistItem(txn(), null, "2569-01");
    expect(item.search.oldOwnerName).toBeNull();
  });

  it("identify block matches LTAX land fields (ระวางแยกช่อง, UTM2→โรมัน, UTM4 pad2, เนื้อที่ 3 ช่อง)", () => {
    const item = buildWorklistItem(txn(), null, "2569-01");
    expect(val(item.identify, "ระวาง")).toBe("5039");
    expect(val(item.identify, "แผนที่ระวางภูมิประเทศ")).toBe("II"); // UTM2 "2" → โรมัน
    expect(val(item.identify, "ระวางUTM")).toBe("4682");
    expect(val(item.identify, "แผ่นที่ระวางUTM")).toBe("07"); // UTM4 "7" → pad2
    expect(val(item.identify, "มาตราส่วน")).toBe("1000");
    expect(val(item.identify, "เลขที่ดิน")).toBe("84");
    expect(val(item.identify, "หน้าสำรวจ")).toBe("13725");
    expect(val(item.identify, "เนื้อที่: ไร่")).toBe("0");
    expect(val(item.identify, "เนื้อที่: งาน")).toBe("2");
    expect(val(item.identify, "เนื้อที่: ตร.ว.")).toBe("24.00");
  });

  it("TRANSFER_PARTIAL -> ADD_OWNER (เพิ่มเจ้าของร่วม, ไม่ลบเจ้าของเดิม)", () => {
    const item = buildWorklistItem(txn({ changeType: "TRANSFER_PARTIAL" }), "นาย ก ข", "2569-01");
    expect(item.action).toBe("ADD_OWNER");
    expect(val(item.steps, "ชื่อ")).toBe("วรารีย์");
    expect(val(item.steps, "เลขประจำตัวประชาชน")).toBe("1609700018248");
    // ห้ามมี step ลบเจ้าของเดิม
    expect(item.steps.some((s) => s.label.includes("ลบเจ้าของเดิม"))).toBe(false);
  });

  it("OWNER_CORRECTION -> CORRECT_OWNER (no remove-old step)", () => {
    const item = buildWorklistItem(txn({ changeType: "OWNER_CORRECTION" }), null, "2569-01");
    expect(item.action).toBe("CORRECT_OWNER");
    expect(val(item.steps, "ชื่อ")).toBe("วรารีย์");
    expect(item.steps.some((s) => s.label.includes("ลบเจ้าของเดิม"))).toBe(false);
    // งานแก้ชื่อ ไม่มีช่องที่อยู่
    expect(val(item.steps, "ตำบล")).toBeUndefined();
    expect(val(item.steps, "บ้านเลขที่")).toBeUndefined();
  });

  it("BOUNDARY_CHANGE -> UPDATE_AREA with rai/ngan/wa", () => {
    const item = buildWorklistItem(txn({ changeType: "BOUNDARY_CHANGE" }), null, "2569-01");
    expect(item.action).toBe("UPDATE_AREA");
    expect(val(item.steps, "ไร่")).toBe("0");
    expect(val(item.steps, "งาน")).toBe("2");
    expect(val(item.steps, "วา")).toBe("24");
    // ไม่มีช่องเจ้าของในงานแก้เนื้อที่
    expect(val(item.steps, "เลขบัตรประชาชน (13 หลัก)")).toBeUndefined();
  });
});

describe("helper ที่เล่มพิมพ์ reuse", () => {
  const raw: Record<string, string> = {
    UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
    "ที่ดิน": "84", "ห.สำรวจ": "13725",
    "13 หลัก": "1-2345-67890-12-3", "คำนำหน้า": "นางสาว", "ชื่อ": "ก", "นามสกุล": "ข",
    OWN_TAMBOL: "ตาคลี",
  };

  it("identifyFields แปลง UTM_MAP2 เป็นเลขโรมันและ pad UTM_MAP4 สองหลัก", () => {
    const f = identifyFields(raw, { rai: 0, ngan: 2, wa: 24, sqm: 896 });
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["แผนที่ระวางภูมิประเทศ"]).toBe("II");
    expect(byLabel["แผ่นที่ระวางUTM"]).toBe("07");
    expect(byLabel["เลขที่ดิน"]).toBe("84");
    expect(byLabel["หน้าสำรวจ"]).toBe("13725");
    expect(byLabel["เนื้อที่: ตร.ว."]).toBe("24.00");
  });

  it("identifyFields ทำงานได้กับ area เป็น null (นิติกรรมที่ไม่มีเนื้อที่)", () => {
    const f = identifyFields(raw, null);
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["เนื้อที่: ไร่"]).toBe("");
    expect(byLabel["ระวาง"]).toBe("5039");
  });

  it("ownerFields ตัดเลขบัตรให้เหลือเฉพาะตัวเลข", () => {
    const f = ownerFields(raw, OWNER_FIELD_COLS);
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["เลขประจำตัวประชาชน"]).toBe("1234567890123");
    expect(byLabel["ตำบล"]).toBe("ตาคลี");
  });
});
