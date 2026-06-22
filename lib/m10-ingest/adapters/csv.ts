import Papa from "papaparse";
import type { DocType, RawRow } from "../types";

export function parseCsv(content: string, docType: DocType, source: string): RawRow[] {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: "greedy" });
  return result.data
    .filter((row) => row && Object.keys(row).length > 0)
    .map((raw) => ({ docType, source, raw }));
}
