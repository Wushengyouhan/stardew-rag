/**
 * 拉取 tests/fixtures/wiki 下的样例页。用法：npx tsx scripts/fetch-fixtures.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const WIKI_API = "https://zh.stardewvalleywiki.com/mediawiki/api.php";
const OUT = join(process.cwd(), "tests/fixtures/wiki");

const PAGES: Array<{ slug: string; title: string; withInfoboxHtml?: boolean }> = [
  { slug: "abigail", title: "阿比盖尔", withInfoboxHtml: true },
  { slug: "parsnip", title: "防风草" },
  { slug: "community-center", title: "社区中心" },
];

async function wikiGet(params: Record<string, string>) {
  const url = `${WIKI_API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": process.env.WIKI_USER_AGENT ?? "stardew-rag (dev)" },
  });
  if (!res.ok) {
    throw new Error(`${params.action} ${params.titles ?? params.page}: ${res.status}`);
  }
  return res.json();
}

function trimInfoboxHtml(html: string): string {
  const start = html.indexOf('id="infoboxborder"');
  if (start < 0) {
    return html.slice(0, 12_000);
  }
  const end = html.indexOf('class="quotetable"', start);
  return end > start ? html.slice(start, end) : html.slice(start, start + 12_000);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const { slug, title, withInfoboxHtml } of PAGES) {
    const query = await wikiGet({
      action: "query",
      prop: "extracts|revisions",
      explaintext: "1",
      rvprop: "ids",
      titles: title,
    });
    const page = query.query.pages[0];
    const record: Record<string, unknown> = {
      pageid: page.pageid,
      title: page.title,
      revid: page.revisions[0].revid,
      extract: page.extract ?? "",
    };
    if (withInfoboxHtml) {
      const parsed = await wikiGet({ action: "parse", page: title, prop: "text" });
      record.parseHtml = trimInfoboxHtml(parsed.parse.text as string);
    }
    writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(record, null, 2), "utf8");
    console.log(slug, page.pageid);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
