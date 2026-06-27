import { describe, it, expect } from "vitest";
import { initialReviewStatus } from "./review";

describe("initialReviewStatus", () => {
  it("ownership/area-affecting with a recordKey -> pending", () => {
    expect(initialReviewStatus("TRANSFER", true)).toBe("pending");
    expect(initialReviewStatus("SPLIT", true)).toBe("pending");
    expect(initialReviewStatus("RETIRED", true)).toBe("pending");
  });
  it("encumbrance/note/admin -> auto", () => {
    expect(initialReviewStatus("ENCUMBRANCE", true)).toBe("auto");
    expect(initialReviewStatus("NOTE", true)).toBe("auto");
    expect(initialReviewStatus("ADMIN", true)).toBe("auto");
  });
  it("no recordKey (e.g. construction) -> auto even if tax-relevant", () => {
    expect(initialReviewStatus("TRANSFER", false)).toBe("auto");
  });
});
