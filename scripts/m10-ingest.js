// รัน: npm run m10:ingest -- public/60070001_60010000.zip --period 2569-01
async function main() {
  const { parseArgs, runCli } = await import("../lib/m10-ingest/cli.ts");
  const dbConnect = require("../lib/dbConnect");
  const args = parseArgs(process.argv.slice(2));
  await (dbConnect.default || dbConnect)();
  console.log(JSON.stringify(await runCli(args), null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
