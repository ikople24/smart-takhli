const S = (v: unknown) => String(v ?? "").trim();

export interface RavangParts { utm1: string; utm2: string; utm3: string; utm4: string; scale: string; }

export function ravangKey(p: RavangParts): string {
  return [S(p.utm1), S(p.utm2), S(p.utm3), S(p.utm4).padStart(2, "0"), S(p.scale)].join("|");
}
export function parcelRecordKey(p: RavangParts, landNumber: string): string {
  return `${ravangKey(p)}|${S(landNumber)}`;
}
// ns3a มี air-map 3 ส่วน (ไม่มี geometry ให้ join) → คีย์รูปแบบเฉพาะ ป้องกันชนกับ parcel
export function ns3aRecordKey(p: { a1: string; a2: string; a3: string; scale: string }, landNumber: string): string {
  return ["NS3A", S(p.a1), S(p.a2), S(p.a3), S(p.scale), S(landNumber)].join("|");
}
