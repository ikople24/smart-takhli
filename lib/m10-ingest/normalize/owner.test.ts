import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildOwner, hashId } from "./owner";

describe("hashId", () => {
  it("hashes digits-only of '13 หลัก' incl. spaces", () => {
    expect(hashId("1 6097 00018 24 8")).toBe(createHash("sha256").update("1609700018248").digest("hex"));
  });
  it("null when no digits", () => { expect(hashId("")).toBeNull(); });
});
describe("buildOwner", () => {
  it("builds trimmed fullName + idHash", () => {
    const o = buildOwner({ title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", id: "1 6097 00018 24 8" });
    expect(o.fullName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
    expect(o.idHash).toBe(createHash("sha256").update("1609700018248").digest("hex"));
  });
  it("no stray spaces when parts missing", () => {
    expect(buildOwner({ title: "", name: "สมหญิง", surname: "", id: "" }).fullName).toBe("สมหญิง");
  });
});
