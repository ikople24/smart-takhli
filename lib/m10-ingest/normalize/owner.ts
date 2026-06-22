import { createHash } from "node:crypto";
import type { Owner } from "../types";

export function hashId(rawId: string): string | null {
  const digits = (rawId ?? "").replace(/\D/g, "");
  return digits === "" ? null : createHash("sha256").update(digits).digest("hex");
}

export function buildOwner(input: { title: string; name: string; surname: string; id: string }): Owner {
  const title = input.title.trim(), name = input.name.trim(), surname = input.surname.trim();
  return { title, name, surname, fullName: [title, name, surname].filter(Boolean).join(" "), idHash: hashId(input.id) };
}
