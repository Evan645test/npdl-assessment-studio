import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "curriculum-odt");
const OUTPUT = path.join(ROOT, "src", "data", "curriculum", "entries.json");
const MANIFEST_OUTPUT = path.join(
  ROOT,
  "src",
  "data",
  "curriculum",
  "manifest.json",
);

const SOURCES = {
  nature: {
    url: "https://www.naer.edu.tw/upload/1/16/doc/820/%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%B0%91%E5%9F%BA%E6%9C%AC%E6%95%99%E8%82%B2%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E6%9A%A8%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E2%94%80%E8%87%AA%E7%84%B6%E7%A7%91%E5%AD%B8%E9%A0%98%E5%9F%9F.odt",
    title: "十二年國民基本教育課程綱要－自然科學領域",
    domain: "自然科學領域",
  },
  social: {
    url: "https://www.naer.edu.tw/upload/1/16/doc/819/%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%B0%91%E5%9F%BA%E6%9C%AC%E6%95%99%E8%82%B2%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E6%9A%A8%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E2%94%80%E7%A4%BE%E6%9C%83%E9%A0%98%E5%9F%9F.odt",
    title: "十二年國民基本教育課程綱要－社會領域",
    domain: "社會領域",
  },
  math: {
    url: "https://www.naer.edu.tw/upload/1/16/doc/815/%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%B0%91%E5%9F%BA%E6%9C%AC%E6%95%99%E8%82%B2%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E6%9A%A8%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E2%94%80%E6%95%B8%E5%AD%B8%E9%A0%98%E5%9F%9F.odt",
    title: "十二年國民基本教育課程綱要－數學領域",
    domain: "數學領域",
  },
  english: {
    url: "https://www.naer.edu.tw/upload/1/16/doc/812/%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%B0%91%E5%9F%BA%E6%9C%AC%E6%95%99%E8%82%B2%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E6%9A%A8%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E8%AA%9E%E6%96%87%E9%A0%98%E5%9F%9F%E2%94%80%E8%8B%B1%E8%AA%9E%E6%96%87.odt",
    title: "十二年國民基本教育課程綱要－語文領域（英語文）",
    domain: "語文領域",
  },
  chinese: {
    url: "https://www.naer.edu.tw/upload/1/16/doc/806/%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%B0%91%E5%9F%BA%E6%9C%AC%E6%95%99%E8%82%B2%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E6%9A%A8%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E8%AA%9E%E6%96%87%E9%A0%98%E5%9F%9F-%E5%9C%8B%E8%AA%9E%E6%96%87.odt",
    title: "十二年國民基本教育課程綱要－語文領域（國語文）",
    domain: "語文領域",
  },
};

function decodeXml(value) {
  return value
    .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, count) =>
      " ".repeat(Number(count || 1)),
    )
    .replace(/<text:tab\s*\/>/g, "\t")
    .replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(xml) {
  const rows = [];
  for (const rowMatch of xml.matchAll(
    /<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g,
  )) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(
      /<table:table-cell\b[^>]*>([\s\S]*?)<\/table:table-cell>/g,
    )) {
      const paragraphs = Array.from(
        cellMatch[1].matchAll(
          /<text:(?:p|h)\b[^>]*>([\s\S]*?)<\/text:(?:p|h)>/g,
        ),
        (match) => decodeXml(match[1]),
      ).filter(Boolean);
      cells.push(paragraphs);
    }
    if (cells.some((cell) => cell.length > 0)) rows.push(cells);
  }
  return rows;
}

function normalizeCode(raw) {
  return raw
    .replace(/^[*◎\s]+/, "")
    .replace(/[：:]\s*$/, "")
    .replaceAll("IV", "Ⅳ")
    .replaceAll("V", "Ⅴ")
    .trim();
}

function stageFromCode(code) {
  if (/[Ⅳ]/.test(code)) return "IV";
  if (/[Ⅴ]/.test(code)) return "V";
  const grade = Number(code.match(/-(\d{1,2})-/)?.[1] ?? 0);
  if (grade >= 7 && grade <= 9) return "IV";
  if (grade >= 10 && grade <= 12) return "V";
  return null;
}

function splitCodes(paragraph, pattern) {
  return Array.from(paragraph.matchAll(pattern), (match) =>
    normalizeCode(match[0]),
  );
}

function inlinePair(paragraph, pattern) {
  const match = paragraph.match(pattern);
  if (!match || match.index !== 0) return null;
  const code = normalizeCode(match[0]);
  const text = paragraph.slice(match[0].length).replace(/^[：:\s]+/, "").trim();
  return text ? { code, text } : null;
}

function extractPairs(rows, pattern) {
  const output = [];
  const genericCodePattern =
    /[*◎\s]*(?:[A-Za-z\u4e00-\u9fff0-9]{1,8})-(?:[ⅣⅤIVV]+[ca]?|\d{1,2})-\d+/g;
  for (const cells of rows) {
    for (const cell of cells) {
      for (const paragraph of cell) {
        const pair = inlinePair(paragraph, pattern);
        if (pair) output.push(pair);
      }
    }
    for (let index = 0; index < cells.length - 1; index += 1) {
      const codes = cells[index].flatMap((paragraph) =>
        splitCodes(paragraph, new RegExp(pattern.source, "g")),
      );
      if (codes.length === 0) continue;
      const allCodes = cells[index].flatMap((paragraph) =>
        splitCodes(paragraph, genericCodePattern),
      );
      // 課綱附錄會在同一格混列學習表現與學習內容。只取整格皆屬
      // 目前類型的資料列，避免用局部代碼去錯配相鄰格的前幾段原文。
      if (allCodes.length !== codes.length) continue;
      const texts = cells[index + 1].filter(
        (paragraph) =>
          paragraph.length >= 2 &&
          splitCodes(paragraph, new RegExp(pattern.source, "g")).length === 0,
      );
      if (texts.length < codes.length) continue;
      for (let item = 0; item < codes.length; item += 1) {
        output.push({ code: codes[item], text: texts[item] });
      }
    }
  }
  return output;
}

function slug(value) {
  const roman = value.replaceAll("Ⅳ", "iv").replaceAll("Ⅴ", "v");
  const ascii = roman
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) return ascii;
  return Array.from(value)
    .map((character) => character.codePointAt(0).toString(16))
    .join("-");
}

function courseType(code) {
  if (/Ⅴc/i.test(code)) return "required";
  if (/Ⅴa/i.test(code)) return "elective";
  return "all";
}

function createEntry(sourceKey, subject, kind, code, text) {
  const source = SOURCES[sourceKey];
  const stage = stageFromCode(code);
  if (!stage || !text.trim()) return null;
  return {
    id: `${slug(subject)}-${kind === "learning_performance" ? "performance" : "content"}-${slug(code)}`,
    domain: source.domain,
    subject,
    stage,
    kind,
    code,
    text: text.trim(),
    courseType: courseType(code),
    sourceName: source.url,
    sourceDocumentTitle: source.title,
    sourceVersion: "108課綱正式發布版",
  };
}

function collectEntries(sourceKey, rows) {
  const entries = [];
  const addPairs = (pairs, subjectFor, kind) => {
    for (const pair of pairs) {
      const subject =
        typeof subjectFor === "function" ? subjectFor(pair.code) : subjectFor;
      if (!subject) continue;
      const entry = createEntry(
        sourceKey,
        subject,
        kind,
        pair.code,
        pair.text,
      );
      if (entry) entries.push(entry);
    }
  };

  if (sourceKey === "nature") {
    addPairs(
      extractPairs(rows, /[a-z]{2}-[ⅣⅤIVV]+[ca]?-\d+/i),
      "自然科學",
      "learning_performance",
    );
    addPairs(
      extractPairs(rows, /[A-Z]{1,3}[a-z]{0,2}-[ⅣⅤIVV]+[ca]?-\d+/),
      (code) => {
        if (stageFromCode(code) === "IV") return "自然科學";
        if (/^P/.test(code)) return "物理";
        if (/^C/.test(code)) return "化學";
        if (/^B/.test(code)) return "生物";
        if (/^E/.test(code)) return "地球科學";
        return "自然科學";
      },
      "learning_content",
    );
  } else if (sourceKey === "social") {
    const socialSubject = (code) =>
      code.startsWith("歷")
        ? "歷史"
        : code.startsWith("地")
          ? "地理"
          : code.startsWith("公")
            ? "公民與社會"
            : null;
    addPairs(
      extractPairs(rows, /[歷地公社][123][abcd]-[ⅣⅤIVV]+-\d+/),
      socialSubject,
      "learning_performance",
    );
    addPairs(
      extractPairs(rows, /[歷地公][A-Z][a-z]?-?[ⅣⅤIVV]+-\d+/),
      socialSubject,
      "learning_content",
    );
  } else if (sourceKey === "math") {
    addPairs(
      extractPairs(rows, /[nsgafd]-[IVV]+-\d+/i),
      "數學",
      "learning_performance",
    );
    addPairs(
      extractPairs(rows, /[NSGAFD]-(?:[789]|10|11|12)-\d+/),
      "數學",
      "learning_content",
    );
  } else {
    const subject = sourceKey === "chinese" ? "國語文" : "英語文";
    addPairs(
      extractPairs(rows, /[*◎\s]*\d{1,2}-[ⅣⅤIVV]+-\d+/),
      subject,
      "learning_performance",
    );
    addPairs(
      extractPairs(rows, /[*◎\s]*[A-Z][a-z]?-?[ⅣⅤIVV]+-\d+/),
      subject,
      "learning_content",
    );
  }
  return entries;
}

async function loadRows(key) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${key}.odt`);
  let buffer;
  try {
    buffer = await readFile(file);
  } catch {
    const response = await fetch(SOURCES[key].url);
    if (!response.ok) {
      throw new Error(`下載 ${key} 課綱失敗：HTTP ${response.status}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(file, buffer);
  }
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error(`${key}.odt 缺少 content.xml`);
  return tableRows(xml);
}

const allEntries = [];
for (const key of Object.keys(SOURCES)) {
  allEntries.push(...collectEntries(key, await loadRows(key)));
}

const grouped = new Map();
for (const entry of allEntries) {
  const key = `${entry.subject}|${entry.kind}|${entry.code}`;
  const byText = grouped.get(key) ?? new Map();
  const existing = byText.get(entry.text);
  byText.set(entry.text, {
    entry,
    count: (existing?.count ?? 0) + 1,
  });
  grouped.set(key, byText);
}

const unique = new Map();
const excludedConflicts = [];
for (const [key, byText] of grouped) {
  const ranked = Array.from(byText.values()).sort(
    (left, right) => right.count - left.count,
  );
  if (
    ranked.length > 1 &&
    ranked[0].count === ranked[1].count &&
    ranked[0].entry.text !== ranked[1].entry.text
  ) {
    excludedConflicts.push({
      key,
      alternatives: ranked
        .filter((item) => item.count === ranked[0].count)
        .map((item) => item.entry.text),
    });
    continue;
  }
  unique.set(key, ranked[0].entry);
}

const entries = Array.from(unique.values()).sort(
  (left, right) =>
    left.stage.localeCompare(right.stage) ||
    left.subject.localeCompare(right.subject, "zh-Hant") ||
    left.kind.localeCompare(right.kind) ||
    left.code.localeCompare(right.code, "zh-Hant", { numeric: true }),
);

const requiredSubjects = [
  "自然科學",
  "化學",
  "生物",
  "物理",
  "地球科學",
  "數學",
  "國語文",
  "英語文",
  "歷史",
  "地理",
  "公民與社會",
];
for (const subject of requiredSubjects) {
  for (const stage of ["IV", "V"]) {
    const relevant =
      subject === "自然科學"
        ? entries.filter(
            (entry) =>
              entry.stage === stage && entry.domain === "自然科學領域",
          )
        : subject === "化學" ||
      subject === "生物" ||
      subject === "物理" ||
      subject === "地球科學"
        ? entries.filter(
            (entry) =>
              entry.stage === stage &&
              (entry.subject === subject || entry.subject === "自然科學"),
          )
        : entries.filter(
            (entry) => entry.subject === subject && entry.stage === stage,
          );
    for (const kind of ["learning_performance", "learning_content"]) {
      if (!relevant.some((entry) => entry.kind === kind)) {
        throw new Error(`${subject} ${stage} 缺少 ${kind}`);
      }
    }
  }
}

const duplicateIds = entries.filter(
  (entry, index) => entries.findIndex((item) => item.id === entry.id) !== index,
);
if (duplicateIds.length > 0) {
  throw new Error(`課綱 ID 重複：${duplicateIds.map((item) => item.id).join(", ")}`);
}

const manifest = {
  snapshotVersion: new Date().toISOString().slice(0, 10),
  notebookUrl:
    "https://notebooklm.google.com/notebook/39674c51-5851-4779-bb87-4cc8f056fcea",
  verification:
    "以國家教育研究院 108 課綱正式發布 ODT 原檔抽取；代碼、原文與階段由同一原檔的學習表現／學習內容表格交叉驗證。NotebookLM 不作為建置或瀏覽器 runtime 相依。",
  excludedConflicts,
  sources: Object.values(SOURCES).map((source) => ({
    sourceName: source.url,
    sourceDocumentTitle: source.title,
    sourceVersion: "108課綱正式發布版",
  })),
};

await writeFile(OUTPUT, `${JSON.stringify(entries, null, 2)}\n`);
await writeFile(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`wrote ${entries.length} curriculum entries\n`);
if (excludedConflicts.length > 0) {
  process.stdout.write(
    `excluded ${excludedConflicts.length} entries with unresolved source-text conflicts\n`,
  );
}
