/**
 * 根据 tests/fixtures/wiki 重新生成 tests/fixtures/chunks/*.jsonl
 * 用法：npm run fixtures:chunks
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkPage, type PageSource } from "../lib/chunk";

const wikiDir = join(process.cwd(), "tests/fixtures/wiki");
const outDir = join(process.cwd(), "tests/fixtures/chunks");

const SLUGS = ["abigail", "parsnip", "community-center"];

mkdirSync(outDir, { recursive: true });

for (const slug of SLUGS) {
  const page = JSON.parse(
    readFileSync(join(wikiDir, `${slug}.json`), "utf8"),
  ) as PageSource;
  const chunks = chunkPage(page);
  const body = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(join(outDir, `${slug}.jsonl`), body, "utf8");
  console.log(`${slug}.jsonl`, chunks.length);
}
