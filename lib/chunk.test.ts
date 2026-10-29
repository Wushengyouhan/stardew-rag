import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chunkPage, extractInfoboxText, type PageSource } from "./chunk";

const wikiDir = join(process.cwd(), "tests/fixtures/wiki");
const chunksDir = join(process.cwd(), "tests/fixtures/chunks");

const FIXTURE_SLUGS = ["abigail", "parsnip", "community-center"] as const;

function loadPage(slug: string): PageSource {
  const raw = JSON.parse(
    readFileSync(join(wikiDir, `${slug}.json`), "utf8"),
  ) as PageSource;
  return raw;
}

function loadGoldenChunks(slug: string) {
  const text = readFileSync(join(chunksDir, `${slug}.jsonl`), "utf8").trim();
  if (!text) {
    return [];
  }
  return text.split("\n").map((line) => JSON.parse(line));
}

describe("chunkPage golden jsonl", () => {
  it.each(FIXTURE_SLUGS)("%s 与 tests/fixtures/chunks 一致", (slug) => {
    expect(chunkPage(loadPage(slug))).toEqual(loadGoldenChunks(slug));
  });
});

describe("chunkPage", () => {
  it("阿比盖尔：infobox 含生日与最爱礼物", () => {
    const page = loadPage("abigail");
    const chunks = chunkPage(page);
    const infobox = chunks.find((c) => c.section === "__infobox__");
    expect(infobox).toBeDefined();
    expect(infobox!.text).toMatch(/生日/);
    expect(infobox!.text).toMatch(/秋季.*13日/);
    expect(infobox!.text).toMatch(/最爱的礼物/);
    expect(infobox!.text).toMatch(/紫水晶/);
    expect(infobox!.text).toMatch(/河豚/);
  });

  it("阿比盖尔：按 H2/H3 切出送礼相关块", () => {
    const page = loadPage("abigail");
    const chunks = chunkPage(page);
    const sections = chunks.map((c) => c.section);
    expect(sections).toContain("送礼");
    expect(sections).toContain("最爱");
    const favorites = chunks.find((c) => c.section === "最爱");
    expect(favorites?.text).toMatch(/紫水晶/);
  });

  it("阿比盖尔：chunk 字段完整且 order 连续", () => {
    const page = loadPage("abigail");
    const chunks = chunkPage(page);
    expect(chunks.length).toBeGreaterThan(5);
    chunks.forEach((c, i) => {
      expect(c.order).toBe(i);
      expect(c.id).toBe(`${page.pageid}#${i}`);
      expect(c.pageid).toBe(page.pageid);
      expect(c.revid).toBe(page.revid);
      expect(c.url).toContain(encodeURIComponent("阿比盖尔"));
      expect(c.text.length).toBeGreaterThan(0);
      expect(c.text).not.toMatch(/mw-parser-output/);
    });
  });

  it("防风草：含收集包段落", () => {
    const page = loadPage("parsnip");
    const chunks = chunkPage(page);
    const pack = chunks.find((c) => c.section === "收集包");
    expect(pack?.text).toMatch(/春季作物收集包/);
  });

  it("社区中心：含收集包段落", () => {
    const page = loadPage("community-center");
    const chunks = chunkPage(page);
    expect(chunks.some((c) => c.section === "收集包")).toBe(true);
    expect(chunks.some((c) => c.text.includes("祝尼魔"))).toBe(true);
  });
});

describe("extractInfoboxText", () => {
  it("无 infobox 时返回 null", () => {
    expect(extractInfoboxText("<p>hello</p>")).toBeNull();
  });
});
