import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractBatch, ZipPasswordError } from "./zip";

const PARCEL_CSV = "REG_CODE,LAND_NO\nขาย,84\n";
const NS3A_CSV = "REG_CODE,LAND_NO\nให้,12\n";
const CON_CSV = "REG_CODE\nขาย\n";
const PASS = "s3cret";

function plainZip(): Buffer {
  const z = new AdmZip();
  z.addFile("batch/parcel_600.csv", Buffer.from(PARCEL_CSV, "utf8"));
  z.addFile("batch/ns3a_600.csv", Buffer.from(NS3A_CSV, "utf8"));
  z.addFile("batch/construction_600.csv", Buffer.from(CON_CSV, "utf8"));
  return z.toBuffer();
}

/** zip เข้ารหัสจริงด้วย zip CLI (ZipCrypto — แบบเดียวกับที่ adm-zip ถอดได้) · คืน null ถ้าเครื่องไม่มี zip */
function encryptedZip(pass: string): Buffer | null {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(join(tmpdir(), "m10zip-"));
    writeFileSync(join(dir, "parcel_600.csv"), PARCEL_CSV);
    writeFileSync(join(dir, "ns3a_600.csv"), NS3A_CSV);
    writeFileSync(join(dir, "construction_600.csv"), CON_CSV);
    execFileSync("zip", ["-q", "-P", pass, "batch.zip", "parcel_600.csv", "ns3a_600.csv", "construction_600.csv"], { cwd: dir });
    return readFileSync(join(dir, "batch.zip"));
  } catch {
    return null;
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

const enc = encryptedZip(PASS);

describe("extractBatch — ไฟล์ไม่ใส่รหัส", () => {
  it("อ่าน CSV ครบสามไฟล์เมื่อไม่ส่งรหัส", () => {
    const b = extractBatch(plainZip());
    expect(b.parcelCsv).toContain("ขาย");
    expect(b.ns3aCsv).toContain("ให้");
    expect(b.constructionCsv).toContain("ขาย");
    expect(b.fileNames).toHaveLength(3);
  });

  it("ส่งรหัสมาด้วยก็ยังอ่านได้ (ไฟล์ไม่ได้เข้ารหัส → ไม่ต้องใช้รหัส)", () => {
    const b = extractBatch(plainZip(), PASS);
    expect(b.parcelCsv).toContain("ขาย");
  });
});

describe("extractBatch — ไฟล์ใส่รหัส (ZipCrypto)", () => {
  it.skipIf(!enc)("รหัสถูก → อ่าน CSV ได้ครบ", () => {
    const b = extractBatch(enc as Buffer, PASS);
    expect(b.parcelCsv).toContain("ขาย");
    expect(b.ns3aCsv).toContain("ให้");
    expect(b.constructionCsv).toContain("ขาย");
  });

  it.skipIf(!enc)("ไม่ส่งรหัส → ฟ้องว่าต้องกรอกรหัส ไม่ใช่ error ดิบ", () => {
    try {
      extractBatch(enc as Buffer);
      throw new Error("ควร throw แต่ไม่ throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ZipPasswordError);
      expect((e as ZipPasswordError).kind).toBe("required");
      expect((e as Error).message).toContain("รหัส");
    }
  });

  it.skipIf(!enc)("รหัสผิด → ฟ้องว่ารหัสไม่ถูกต้อง", () => {
    try {
      extractBatch(enc as Buffer, "wrong-pass");
      throw new Error("ควร throw แต่ไม่ throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ZipPasswordError);
      expect((e as ZipPasswordError).kind).toBe("wrong");
    }
  });
});
