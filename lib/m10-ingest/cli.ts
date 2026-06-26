import { readFile } from "node:fs/promises";
import { ingestZip, type IngestResult } from "./ingest";

export interface CliArgs { zipPath: string; period: string; }
export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let zipPath = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
    else zipPath = argv[i];
  }
  if (!zipPath) throw new Error("usage: m10:ingest <file.zip> --period 2569-01");
  if (!args.period) throw new Error("missing --period (e.g. --period 2569-01)");
  return { zipPath, period: args.period };
}
export async function runCli(args: CliArgs): Promise<IngestResult> {
  const buf = await readFile(args.zipPath);
  return ingestZip(buf, { period: args.period });
}
