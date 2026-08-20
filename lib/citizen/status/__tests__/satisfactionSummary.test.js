import { describe, it, expect } from "vitest";
import { summarizeSatisfaction, satisfactionLabel, MAX_RATINGS } from "../satisfactionSummary";

describe("satisfactionLabel — ขอบเขตเดียวกับการ์ดเดิม SatisfactionChart", () => {
  it("80/60/40 คือเส้นแบ่ง", () => {
    expect(satisfactionLabel(100).text).toBe("พอใจมาก");
    expect(satisfactionLabel(80).text).toBe("พอใจมาก");
    expect(satisfactionLabel(79).text).toBe("พอใจ");
    expect(satisfactionLabel(60).text).toBe("พอใจ");
    expect(satisfactionLabel(59).text).toBe("ปานกลาง");
    expect(satisfactionLabel(40).text).toBe("ปานกลาง");
    expect(satisfactionLabel(39).text).toBe("ควรปรับปรุง");
    expect(satisfactionLabel(0).text).toBe("ควรปรับปรุง");
  });
});

describe("summarizeSatisfaction", () => {
  it("เฉลี่ยดาว → เปอร์เซ็นต์ = เฉลี่ย × 20", () => {
    const s = summarizeSatisfaction([{ rating: 5 }, { rating: 4 }]);
    expect(s.count).toBe(2);
    expect(s.average).toBe(4.5);
    expect(s.percent).toBe(90);
    expect(s.label.text).toBe("พอใจมาก");
  });
  it("ปัดเปอร์เซ็นต์เป็นจำนวนเต็ม", () => {
    // เฉลี่ย 3.6667 × 20 = 73.33 → 73
    expect(summarizeSatisfaction([{ rating: 4 }, { rating: 4 }, { rating: 3 }]).percent).toBe(73);
  });
  it("ไม่มีข้อมูล → count 0 และไม่มีป้าย (การ์ดจะไม่แสดง)", () => {
    expect(summarizeSatisfaction([])).toEqual({ count: 0, average: 0, percent: 0, label: null, comments: [] });
    expect(summarizeSatisfaction(null).count).toBe(0);
    expect(summarizeSatisfaction(undefined).count).toBe(0);
  });
  it("แถวที่ rating ใช้ไม่ได้ถูกตัดทิ้ง ไม่ให้ค่าเฉลี่ยเพี้ยน", () => {
    const s = summarizeSatisfaction([{ rating: 5 }, { rating: null }, { comment: "ดี" }, { rating: "3" }]);
    expect(s.count).toBe(2);
    expect(s.average).toBe(4);
  });
  it("แยกเฉพาะรายการที่มีความเห็นจริง", () => {
    const s = summarizeSatisfaction([
      { rating: 5, comment: "เร็วดีมาก" },
      { rating: 4, comment: "   " },
      { rating: 3 },
    ]);
    expect(s.comments).toHaveLength(1);
    expect(s.comments[0].comment).toBe("เร็วดีมาก");
  });
  it("เพดานการให้คะแนนคือ 4 ครั้งต่อเรื่อง", () => {
    expect(MAX_RATINGS).toBe(4);
  });
});
