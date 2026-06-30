import { describe, it, expect } from "vitest";
import { parseParcelCode, nextBlockSeq, nextSuffix } from "./parcelCode";

describe("parseParcelCode", () => {
  it("แยก zone/block/seq/suffixes", () => {
    expect(parseParcelCode("07K002")).toEqual({ zone: "07", block: "K", seq: "002", suffixes: [] });
    expect(parseParcelCode("07K002/004")).toEqual({ zone: "07", block: "K", seq: "002", suffixes: ["004"] });
    expect(parseParcelCode("01A001/002/01")).toEqual({ zone: "01", block: "A", seq: "001", suffixes: ["002", "01"] });
    expect(parseParcelCode("bad")).toBeNull();
  });
});

describe("nextBlockSeq", () => {
  it("seq ถัดไปในบล็อก (3 หลัก), ข้ามเลขหาย, บล็อกว่าง = 001", () => {
    expect(nextBlockSeq("02B", ["02B120", "02B118", "02A001"])).toBe("02B121");
    expect(nextBlockSeq("02B", [])).toBe("02B001");
    expect(nextBlockSeq("02B", ["02B005", "02B003"])).toBe("02B006");
    // รหัสที่มี suffix นับ base seq ด้วย (120 ถูกใช้แล้ว → 121)
    expect(nextBlockSeq("02B", ["02B120/001"])).toBe("02B121");
  });
});

describe("nextSuffix", () => {
  it("รหัสลูกถัดไปตามชั้น", () => {
    expect(nextSuffix("01A001", [])).toBe("01A001/001");
    expect(nextSuffix("01A001", ["01A001/001"])).toBe("01A001/002");
    expect(nextSuffix("01A001", ["01A001/001", "01A001/003"])).toBe("01A001/004");
    // ชั้น 2: parent มี suffix แล้ว → /01
    expect(nextSuffix("01A001/002", [])).toBe("01A001/002/01");
    expect(nextSuffix("01A001/002", ["01A001/002/01"])).toBe("01A001/002/02");
    // ชั้น 3 → /1
    expect(nextSuffix("01A001/002/01", [])).toBe("01A001/002/01/1");
  });
});
