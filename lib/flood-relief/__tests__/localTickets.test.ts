import { describe, it, expect } from "vitest";
import { addLocalTicket, localKeyFor, MAX_LOCAL_TICKETS, parseLocalTickets } from "../localTickets";

describe("parseLocalTickets", () => {
  it("ค่าว่าง/JSON พัง/ไม่ใช่ array = []", () => {
    expect(parseLocalTickets(null)).toEqual([]);
    expect(parseLocalTickets("{oops")).toEqual([]);
    expect(parseLocalTickets('{"a":1}')).toEqual([]);
  });

  it("ข้ามรายการที่เลขผิดรูปแบบหรือซ้ำ", () => {
    const raw = JSON.stringify([
      { ticket: "FL-0002", key: "k2", at: "x" },
      { ticket: "bad" },
      { ticket: "fl-0002", key: "dup" },
      { ticket: "FL-0001" },
    ]);
    expect(parseLocalTickets(raw)).toEqual([
      { ticket: "FL-0002", key: "k2", at: "x" },
      { ticket: "FL-0001", key: "", at: "" },
    ]);
  });
});

describe("addLocalTicket / localKeyFor", () => {
  it("ล่าสุดขึ้นก่อน · เลขซ้ำแทนที่ · จำกัดจำนวน", () => {
    let list = addLocalTicket([], { ticket: "FL-0001", key: "a", at: "" });
    list = addLocalTicket(list, { ticket: "FL-0002", key: "b", at: "" });
    list = addLocalTicket(list, { ticket: "FL-0001", key: "c", at: "" });
    expect(list.map((t) => t.ticket)).toEqual(["FL-0001", "FL-0002"]);
    expect(localKeyFor(list, "FL-0001")).toBe("c");
    expect(localKeyFor(list, "FL-0009")).toBe("");

    let many: ReturnType<typeof addLocalTicket> = [];
    for (let i = 1; i <= MAX_LOCAL_TICKETS + 5; i++) {
      many = addLocalTicket(many, { ticket: `FL-${String(i).padStart(4, "0")}`, key: "", at: "" });
    }
    expect(many).toHaveLength(MAX_LOCAL_TICKETS);
    expect(many[0].ticket).toBe(`FL-${String(MAX_LOCAL_TICKETS + 5).padStart(4, "0")}`);
  });
});
