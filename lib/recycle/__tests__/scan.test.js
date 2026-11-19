import { describe, it, expect } from "vitest";
import { parseScannedCard } from "../scan";

describe("parseScannedCard", () => {
  it("อ่าน token จากลิงก์บนบัตร (โดเมนไหนก็ได้)", () => {
    expect(parseScannedCard("https://www.smart-takhli.app/recycle/m/aB3dE5fG7hJ9")).toEqual({ token: "aB3dE5fG7hJ9" });
    expect(parseScannedCard("http://localhost:3000/recycle/m/aB3dE5fG7hJ9?view=member")).toEqual({ token: "aB3dE5fG7hJ9" });
  });
  it("อ่าน path อย่างเดียวได้", () => {
    expect(parseScannedCard("/recycle/m/aB3dE5fG7hJ9")).toEqual({ token: "aB3dE5fG7hJ9" });
  });
  it("อ่านรหัสสมาชิก PS-xxxx", () => {
    expect(parseScannedCard(" ps-12 ")).toEqual({ code: "PS-0012" });
    expect(parseScannedCard("PS-0007")).toEqual({ code: "PS-0007" });
  });
  it("QR อื่นที่ไม่ใช่บัตรสมาชิก → null", () => {
    expect(parseScannedCard("https://example.com/hello")).toBeNull();
    expect(parseScannedCard("/recycle/m/short")).toBeNull();
    expect(parseScannedCard("")).toBeNull();
    expect(parseScannedCard(null)).toBeNull();
  });
});
