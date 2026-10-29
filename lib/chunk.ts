import * as cheerio from "cheerio";

const WIKI_BASE = "https://zh.stardewvalleywiki.com";

export type Chunk = {
  id: string;
  pageid: number;
  title: string;
  url: string;
  section: string;
  text: string;
  revid: number;
  order: number;
};

export type PageSource = {
  pageid: number;
  title: string;
  revid: number;
  extract: string;
  parseHtml?: string;
};

export function wikiPageUrl(title: string): string {
  const path = title.replace(/ /g, "_");
  return `${WIKI_BASE}/${encodeURIComponent(path)}`;
}

function stripWikiNoise(text: string): string {
  return text
    .replace(/\.mw-parser-output[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractInfoboxText(parseHtml: string): string | null {
  const $ = cheerio.load(parseHtml);
  $("style").remove();
  const table = $("#infoboxtable");
  if (!table.length) {
    return null;
  }

  const lines: string[] = [];
  table.find("tr").each((_, tr) => {
    const header = $(tr).find("#infoboxheader").text().replace(/\s+/g, " ").trim();
    if (header) {
      lines.push(header);
      return;
    }
    const label = stripWikiNoise($(tr).find("#infoboxsection").text());
    const value = stripWikiNoise($(tr).find("#infoboxdetail").text());
    if (label && value) {
      lines.push(`${label}：${value}`);
    }
  });

  const text = lines.join("\n").trim();
  return text.length > 0 ? text : null;
}

type ParsedSection = {
  level: number;
  title: string;
  content: string;
};

function cleanBody(raw: string): string {
  const lines = raw.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }
    if (/^[\t\s]+$/.test(line)) {
      continue;
    }
    kept.push(trimmed);
  }
  return kept.join("\n").trim();
}

export function parseExtractSections(extract: string): ParsedSection[] {
  const lines = extract.split("\n");
  const sections: ParsedSection[] = [];
  let leadLines: string[] = [];
  let current: ParsedSection | null = null;

  const flush = () => {
    if (!current) {
      return;
    }
    current.content = cleanBody(current.content);
    sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (heading) {
      flush();
      if (leadLines.length > 0) {
        const lead = cleanBody(leadLines.join("\n"));
        if (lead) {
          sections.push({ level: 0, title: "__lead__", content: lead });
        }
        leadLines = [];
      }
      current = {
        level: heading[1].length,
        title: heading[2].trim(),
        content: "",
      };
      continue;
    }

    if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      leadLines.push(line);
    }
  }

  flush();
  if (leadLines.length > 0) {
    const lead = cleanBody(leadLines.join("\n"));
    if (lead) {
      sections.push({ level: 0, title: "__lead__", content: lead });
    }
  }

  return sections;
}

export function chunkPage(source: PageSource): Chunk[] {
  const chunks: Chunk[] = [];
  const url = wikiPageUrl(source.title);
  let order = 0;

  if (source.parseHtml) {
    const infobox = extractInfoboxText(source.parseHtml);
    if (infobox) {
      chunks.push({
        id: `${source.pageid}#${order}`,
        pageid: source.pageid,
        title: source.title,
        url,
        section: "__infobox__",
        text: infobox,
        revid: source.revid,
        order,
      });
      order += 1;
    }
  }

  const sections = parseExtractSections(source.extract);
  let lastChunkIndex: number | null = null;

  for (const section of sections) {
    if (section.level === 0) {
      if (!section.content) {
        continue;
      }
      chunks.push({
        id: `${source.pageid}#${order}`,
        pageid: source.pageid,
        title: source.title,
        url,
        section: "__lead__",
        text: section.content,
        revid: source.revid,
        order,
      });
      order += 1;
      lastChunkIndex = chunks.length - 1;
      continue;
    }

    if (section.level === 2 || section.level === 3) {
      if (!section.content) {
        continue;
      }
      chunks.push({
        id: `${source.pageid}#${order}`,
        pageid: source.pageid,
        title: source.title,
        url,
        section: section.title,
        text: section.content,
        revid: source.revid,
        order,
      });
      order += 1;
      lastChunkIndex = chunks.length - 1;
      continue;
    }

    if (section.level >= 4 && lastChunkIndex !== null && section.content) {
      const prev = chunks[lastChunkIndex];
      prev.text = `${prev.text}\n\n${section.title}\n${section.content}`.trim();
    }
  }

  return chunks;
}
