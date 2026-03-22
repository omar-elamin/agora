/**
 * Seed script: converts TemporalWiki v2 eval_set.jsonl → data/datasets/temporalwiki-v2.json
 *
 * Usage: npx tsx scripts/seed-temporalwiki-v2.ts
 */
import fs from "fs";
import path from "path";

const SOURCE = path.resolve(
  process.env.HOME ?? "~",
  "Projects/agora-temporalwiki/output_v2/eval_set.jsonl"
);
const OUT_DIR = path.join(process.cwd(), "data", "datasets");
const OUT_FILE = path.join(OUT_DIR, "temporalwiki-v2.json");

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source file not found: ${SOURCE}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines = fs.readFileSync(SOURCE, "utf8").trim().split("\n");
  const rows = lines.map((line) => JSON.parse(line));

  fs.writeFileSync(OUT_FILE, JSON.stringify(rows));
  console.log(`Wrote ${rows.length} rows to ${OUT_FILE}`);
}

main();
