import { describe, it, expect } from "vitest";
import { buildWorklistItem, type WorklistTxnInput } from "./buildWorklistItem";
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
    expect(val(item.steps, "เลขบัตรประชาชน (13 หลัก)")).toBe("1609700018248"); // เลขล้วน (ตรง LTAX)
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
