import { describe, it, expect } from "vitest";
import { formatTicket, parseTicket, TICKET_COUNTER_ID } from "../ticket";

describe("formatTicket / parseTicket — เลขที่แบบสั้น FL-0142", () => {
  it("เติม 0 ให้ครบ 4 หลัก", () => {
    expect(formatTicket(142)).toBe("FL-0142");
    expect(formatTicket(1)).toBe("FL-0001");
  });

  it("เกิน 9999 ไม่ตัดทิ้ง", () => {
    expect(formatTicket(12345)).toBe("FL-12345");
  });

  it("ลำดับต้องเป็นจำนวนเต็มบวก", () => {
    expect(() => formatTicket(0)).toThrow();
    expect(() => formatTicket(1.5)).toThrow();
  });

  it("parse กลับได้ค่าเดิม และรับตัวพิมพ์เล็ก/ช่องว่าง", () => {
    expect(parseTicket("FL-0142")).toEqual({ seq: 142, ticket: "FL-0142" });
    expect(parseTicket("  fl-0142 ")?.ticket).toBe("FL-0142");
    expect(parseTicket("FL-12345")?.seq).toBe(12345);
  });

  it("รูปแบบผิด = null", () => {
    expect(parseTicket("FL-142")).toBeNull();
    expect(parseTicket("FL-2569-0142")).toBeNull();
    expect(parseTicket("TKC-690001")).toBeNull();
    expect(parseTicket("FL-0000")).toBeNull();
    expect(parseTicket(null)).toBeNull();
    expect(parseTicket({ $ne: null })).toBeNull();
  });

  it("counter ตัวเดียวไม่รีเซ็ตรายปี (ticket เป็น unique)", () => {
    expect(TICKET_COUNTER_ID).toBe("flood-ticket");
  });
});
