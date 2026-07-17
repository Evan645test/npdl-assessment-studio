#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROGRESSION_NAMES = ["證據有限", "萌芽", "發展", "精熟"];
const NARRATIVE_SECTIONS = ["進程辨識線索", "學生內在思考", "教學引導與鷹架"];
const PRE_FORBIDDEN_TERMS = [
  "等一下要做",
  "實驗前",
  "上課會學到",
  "本堂課",
  "課程目標",
  "學習目標",
  "實驗室",
  "探究活動",
  "公式",
  "定理",
  "反應速率",
  "化學反應",
  "濃度",
  "催化",
  "活化能",
];
const PRE_SCENARIO_CUES = ["不同", "猶豫", "決定", "選擇", "發現", "比較", "懷疑", "異常", "分歧", "不一致", "不完整", "補充", "判斷"];
const POST_CHALLENGE_CUES = ["失效", "異常", "不一致", "分歧", "質疑", "無法", "誤差", "矛盾", "重新", "調整", "限制", "補充", "判斷", "標準"];
const EVIDENCE_CUES = ["資料", "證據", "紀錄", "照片", "表格", "觀察", "描述", "時間", "數據", "測量", "說法"];
const TASK_CUES = ["判斷", "決定", "比較", "補充", "調整", "確認", "選擇", "提出", "改善"];
const OVER_STORY_CUES = ["他想起", "她想起", "家庭背景", "個性", "從小", "心情很", "大吵", "責怪", "崩潰"];
const QUESTION_LADDER_CUES = {
  1: ["最直接", "先", "第一步", "基本", "哪一項資料", "哪一項證據", "目前"],
  2: ["不一致", "比較", "理由", "可信", "可靠", "取捨", "標準", "判斷方式"],
  3: ["下次", "調整", "補充", "改善", "遷移", "新情境", "重新設計", "更可靠"],
};
const ESCAPE_OPTION_PATTERNS = [/以上皆是/, /以上皆非/, /都可以/, /看情況/, /無法判斷/, /不需要處理/];
const DEVELOPING_RUBRIC_CUES = ["比較", "整合", "整理", "具體", "步驟", "改進", "檢查", "處理", "調整"];
const MASTERING_RUBRIC_CUES = ["遷移", "限制", "規準", "可信", "替代", "驗證", "反思", "調整", "備援"];
const HIGH_SCORE_OBVIOUS_CUES = ["同時", "整合", "設計", "規準", "驗證", "備援", "遷移", "補充", "重新"];
const SHARED_PROBLEM_ANCHORS = ["上述", "同一", "延續", "仍針對", "此情境", "這個情境", "面對同一", "若下次", "仍須"];
const EXPECTED_SCORES = {
  1: [-1, 1, 2, 3],
  2: [1, 2, 3, 4],
  3: [1, 3, 5, 6],
};
const DEFAULT_FORM = {
  grade: "高二",
  subject: "化學",
  activityName: "反應速率 - 硫粒子生成實驗",
  lifeKeywords: "食物腐敗",
  tools: "手機計時、照片對照",
};

function compactLength(value) {
  return Array.from(value.replace(/\s/g, "")).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitModules(markdown) {
  return markdown
    .split(/(?=^## )/m)
    .filter((part) => part.trim().startsWith("##"));
}

function moduleByKeyword(markdown, keyword) {
  return splitModules(markdown).find((part) => part.includes(keyword)) ?? "";
}

function extractScenario(block, label) {
  const marker = `【${label}共用情境】`;
  const start = block.indexOf(marker);
  if (start < 0) return "";
  const after = block.slice(start + marker.length);
  const end = after.search(/\*\*Q1\.|>\s*\*\*Q1\./);
  return (end < 0 ? after : after.slice(0, end)).replace(/\*/g, "").trim();
}

function getQuestionSection(block, qNum) {
  const qRe = new RegExp(`\\*\\*Q${qNum}[^]*?(?=\\*\\*Q[1-4]|\\*\\*【統計|$)`, "s");
  return block.match(qRe)?.[0] ?? "";
}

function extractOptions(section) {
  return [...section.matchAll(/^\s*>?\s*\(([A-D])\)\s*([^\n]+)/gm)].map((match) => `(${match[1]}) ${match[2].trim()}`);
}

function extractQuestionStem(section) {
  const match = section.match(/\*\*Q[1-3][^*]*\*\*[:：]?[「"]?([^」"\n]+)/);
  return match?.[1]?.trim() ?? "";
}

function extractTeacherScores(section) {
  const scores = new Map();
  const parseStart = section.search(/教師解析/);
  const source = parseStart >= 0 ? section.slice(parseStart) : section;
  for (const match of source.matchAll(/([A-D])\s*[:：]\s*([+-]?\d+)/gi)) {
    scores.set(match[1].toUpperCase(), Number(match[2]));
  }
  return scores;
}

function splitKeywords(value) {
  return value
    .split(/[、,，;；\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function tokenizeForOverlap(text) {
  const cleaned = text.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
  const tokens = new Set();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= cleaned.length - size; index += 1) {
      tokens.add(cleaned.slice(index, index + size));
    }
  }
  return tokens;
}

function overlapRatio(a, b) {
  const left = tokenizeForOverlap(a);
  const right = tokenizeForOverlap(b);
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const token of left) {
    if (right.has(token)) hit += 1;
  }
  return hit / Math.min(left.size, right.size);
}

function optionBody(option) {
  return option.replace(/^\([A-D]\)\s*/, "").trim();
}

function optionLetter(option) {
  return option.match(/^\(([A-D])\)/)?.[1] ?? "";
}

function parseOptionScores(explanation) {
  const result = {};
  const normalized = explanation.replace(/^>\s?/gm, "").replace(/\s+/g, " ").trim();
  const chunks = normalized.split(/(?=[A-D]\s*[:：]\s*[+-]?\d+)/i).filter(Boolean);
  for (const chunk of chunks) {
    const match = chunk.trim().match(/^([A-D])\s*[:：]\s*([+-]?\d+)\s*(?:[（(]([^）)]*)[）)]|(?:[，,、]\s*)?(.+?))(?:[；;]\s*)?$/);
    if (!match) continue;
    result[match[1].toUpperCase()] = { score: match[2], desc: (match[3] ?? match[4] ?? "").trim() };
  }
  return result;
}

function extractTeacherParseText(section) {
  const parseStart = section.search(/\*\*教師解析\*\*/);
  if (parseStart < 0) return "";
  return section.slice(parseStart).replace(/^\*\*教師解析\*\*[:：]?\s*/, "").trim();
}

function extractRubricLevelText(q4Section, level) {
  const match = q4Section.match(new RegExp(`-\\s*\\*\\*${level}[^\\*]*\\*\\*[:：]?\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function optionsOnlyDifferByLength(options) {
  if (options.length !== 4) return false;
  const normalized = options.map((option) => optionBody(option).replace(/\s/g, ""));
  const sorted = [...normalized].sort((a, b) => a.length - b.length);
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];
  if (!shortest || !longest) return false;
  const nested = sorted.every((body) => longest.includes(body) || body.includes(longest.slice(0, body.length)));
  return nested && longest.length / shortest.length >= 1.35;
}

function isHighScoreOptionTooObvious(options, scores) {
  if (options.length !== 4 || scores.size !== 4) return false;
  const lengths = options.map((option) => ({ letter: optionLetter(option), len: compactLength(optionBody(option)) }));
  const maxLen = Math.max(...lengths.map((item) => item.len));
  const minLen = Math.min(...lengths.map((item) => item.len));
  const maxScore = Math.max(...scores.values());
  const highScoreLetters = [...scores.entries()].filter(([, score]) => score === maxScore).map(([letter]) => letter);
  const longestLetters = lengths.filter((item) => item.len === maxLen).map((item) => item.letter);
  return highScoreLetters.some((letter) => longestLetters.includes(letter)) && minLen > 0 && maxLen / minLen >= 1.8;
}

function teacherParseRestatesOptions(section, options) {
  const parsed = parseOptionScores(extractTeacherParseText(section));
  let restateCount = 0;
  for (const option of options) {
    const letter = optionLetter(option);
    const desc = parsed[letter]?.desc ?? "";
    if (desc && overlapRatio(optionBody(option), desc) >= 0.42) restateCount += 1;
  }
  return restateCount >= 3;
}

function validateSharedProblem(block, label, warnings) {
  const scenario = extractScenario(block, label);
  const stems = [1, 2, 3].map((q) => extractQuestionStem(getQuestionSection(block, q)));
  if (!scenario || stems.some((stem) => !stem)) return;
  const hasAnchor = stems.some((stem) => SHARED_PROBLEM_ANCHORS.some((anchor) => stem.includes(anchor)));
  const scenarioLinks = stems.map((stem) => overlapRatio(scenario, stem));
  const pairOverlaps = [overlapRatio(stems[0], stems[1]), overlapRatio(stems[1], stems[2]), overlapRatio(stems[0], stems[2])];
  if (!hasAnchor && scenarioLinks.filter((ratio) => ratio < 0.08).length >= 2 && pairOverlaps.every((ratio) => ratio < 0.06)) {
    warnings.push(`${label} Q1–Q3 題幹可能未共用同一問題情境（與共用情境連結弱）`);
  } else if (!hasAnchor && pairOverlaps.every((ratio) => ratio < 0.06)) {
    warnings.push(`${label} Q1–Q3 題幹彼此關聯弱，可能各問各的而非同一問題階梯`);
  }
}

function validateQ4Discrimination(block, label, errors) {
  const q4 = block.match(/\*\*Q4[^]*?(?=\*\*【統計|$)/s)?.[0] ?? "";
  if (!q4) return;
  if (/發展→精熟|Transitional/i.test(q4)) {
    errors.push(`${label} Q4 使用舊三層格式（發展→精熟），無法穩定鑑別四層進程`);
  }
  const developing = extractRubricLevelText(q4, "發展");
  const mastering = extractRubricLevelText(q4, "精熟");
  if (!developing || !mastering) {
    errors.push(`${label} Q4 缺少「發展」或「精熟」判定句`);
    return;
  }
}

function validateGeneratedMarkdown(markdown, form) {
  const errors = [];
  const warnings = [];
  const trimmed = markdown.trim();
  if (!trimmed) return { ok: false, errors: ["產出為空"], warnings };
  if (/```/.test(trimmed)) errors.push("產出包含 code fence（```）");

  const h2Matches = [...trimmed.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  for (const title of ["課程敘述語", "課前：思維診斷", "課後：轉折遷移"]) {
    if (!h2Matches.includes(title)) errors.push(`缺少二級標題「## ${title}」`);
  }
  if (h2Matches.length !== 3) errors.push(`偵測到 ${h2Matches.length} 個 ## 標題（預期 3 個）`);

  const narrative = moduleByKeyword(trimmed, "課程敘述語");
  const pre = moduleByKeyword(trimmed, "課前");
  const post = moduleByKeyword(trimmed, "課後");

  for (const name of PROGRESSION_NAMES) {
    if (!narrative.includes(`【${name}】`)) errors.push(`課程敘述語缺少進程「【${name}】」`);
  }
  for (const section of NARRATIVE_SECTIONS) {
    if (!narrative.includes(section)) errors.push(`課程敘述語缺少段落「${section}」`);
  }

  validateAssessmentModule(pre, "課前", form, errors, warnings);
  validateAssessmentModule(post, "課後", form, errors, warnings);

  return { ok: errors.length === 0, errors, warnings };
}

function validateAssessmentModule(block, label, form, errors, warnings) {
  if (!block) {
    errors.push(`無法解析「${label}」模組`);
    return;
  }

  if (!block.includes(`【${label}共用情境】`)) errors.push(`${label}模組缺少「【${label}共用情境】」`);
  if (!block.includes("【統計規格與總分落點標準】")) errors.push(`${label}模組缺少「【統計規格與總分落點標準】」`);
  if (/^\s*>\s*\([A-D]\)[^\n]*\(\s*[+-]?\d+\s*\)/m.test(block)) {
    errors.push(`${label}選項文字中出現分數標記`);
  }

  const scenario = extractScenario(block, label);
  if (scenario) {
    validateScenario(scenario, label, form, errors, warnings);
  }

  for (const q of [1, 2, 3]) {
    const section = getQuestionSection(block, q);
    if (!section) {
      errors.push(`${label} Q${q} 缺少題目區塊`);
      continue;
    }
    const options = extractOptions(section);
    if (options.length !== 4) errors.push(`${label} Q${q} 缺少 (A)–(D) 四個選項`);
    if (options.some((option) => ESCAPE_OPTION_PATTERNS.some((pattern) => pattern.test(option)))) {
      errors.push(`${label} Q${q} 含逃避型選項`);
    }
    const scores = extractTeacherScores(section);
    const missingLetters = ["A", "B", "C", "D"].filter((letter) => !scores.has(letter));
    if (missingLetters.length > 0) errors.push(`${label} Q${q} 教師解析缺少 ${missingLetters.join("、")} 選項分數`);
    const actual = [...scores.values()].sort((a, b) => a - b).join(",");
    const expected = EXPECTED_SCORES[q].slice().sort((a, b) => a - b).join(",");
    if (scores.size === 4 && actual !== expected) errors.push(`${label} Q${q} 教師解析分數組合錯誤`);
  }

  validateQ4Discrimination(block, label, errors);

  const q4 = block.match(/\*\*Q4[^]*?(?=\*\*【統計|$)/s)?.[0] ?? "";
  if (!/教師進程判定標準/.test(q4) || !/發展/.test(q4) || !/精熟/.test(q4)) {
    errors.push(`${label} Q4 缺少教師進程判定標準`);
  }
}

function validateScenario(scenario, label, form, errors) {
  if (label === "課前") {
    const forbidden = [form.activityName, form.subject, ...PRE_FORBIDDEN_TERMS].filter((term) => term.length >= 2);
    const leaked = forbidden.find((term) => new RegExp(escapeRegExp(term), "i").test(scenario));
    if (leaked) errors.push(`課前情境出現課程洩漏詞「${leaked}」`);
    return;
  }

  if (!scenario.includes(form.activityName)) errors.push("課後情境必須明確提及活動名稱");
}

function parseArgs(argv) {
  const args = { file: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--file") args.file = argv[index + 1] ?? null;
  }
  return args;
}

function assertResult(name, result, expectedOk) {
  if (result.ok !== expectedOk) {
    console.error(`品質 smoke test 失敗：${name}`);
    console.error(`預期 ok=${expectedOk}，實際 ok=${result.ok}`);
    for (const error of result.errors) console.error(`ERROR ${error}`);
    for (const warning of result.warnings) console.error(`WARN ${warning}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
  for (const warning of result.warnings) console.log(`WARN ${warning}`);
}

function assertScaffoldedQ4(markdown) {
  const checks = [
    ["> **問題**：", 6],
    ["> **先看哪裡**：", 6],
    ["> **可以這樣開始**：", 6],
    ["> **情境核對資料**：", 2],
    ["**① 概念理解**", 2],
    ["**② 行動應用**", 2],
    ["**③ 生活遷移**", 2],
    ["**萌芽 → 發展｜已跨界證據**", 2],
    ["**發展 → 精熟｜已跨界證據**", 2],
    ["**教師概念理解註記**", 1],
    ["**教師生活遷移註記**", 1],
    ["[概念理解題]", 2],
    ["[行動應用題]", 2],
    ["[生活遷移題]", 2],
  ];
  for (const [marker, expected] of checks) {
    const count = markdown.split(marker).length - 1;
    if (count !== expected) {
      console.error(`品質 smoke test 失敗：Q4 標記「${marker}」預期 ${expected} 次，實際 ${count} 次`);
      process.exitCode = 1;
      return;
    }
  }
  if (markdown.includes("Q4情境要素｜") || /\*\*問題\*\*：\s*我會/.test(markdown)) {
    console.error("品質 smoke test 失敗：Q4 洩漏模型情境標記或答案化問句");
    process.exitCode = 1;
    return;
  }
  console.log("PASS strategy-aligned Q1–Q4 scaffold fixture");
}

const VALID_MARKDOWN = `## 課程敘述語

### 【證據有限】
**進程辨識線索**：
- **課堂行為特徵**：學生只看見單一現象，尚未主動比較。

**學生內在思考**：
- **學習動機與價值觀**：我先照眼前最明顯的線索判斷。

**教學引導與鷹架**：
- **關鍵活動設計**：提供觀察表，要求記錄至少兩個線索。

### 【萌芽】
**進程辨識線索**：
- **課堂行為特徵**：學生能指出差異，但理由仍零散。

**學生內在思考**：
- **學習動機與價值觀**：我知道要找證據，但還不確定怎麼排序。

**教學引導與鷹架**：
- **關鍵活動設計**：用同儕提問協助補足證據。

### 【發展】
**進程辨識線索**：
- **課堂行為特徵**：學生能比較多筆證據並提出策略。

**學生內在思考**：
- **學習動機與價值觀**：我會先確認資料再決定行動。

**教學引導與鷹架**：
- **關鍵活動設計**：安排小組檢核與修正。

### 【精熟】
**進程辨識線索**：
- **課堂行為特徵**：學生能在新限制下調整判斷。

**學生內在思考**：
- **學習動機與價值觀**：我能說明證據限制並提出替代方案。

**教學引導與鷹架**：
- **關鍵活動設計**：要求學生設計可遷移的判斷規準。

## 課前：思維診斷

**【課前共用情境】**
園遊會飲料保存小組把同一款飲料分成兩杯，一杯放窗邊，一杯放陰影處，並留下照片、放置時間與簡短觀察紀錄。放學前，窗邊那杯出現酸味與細小泡泡，但照片角度不一致，觀察描述也沒有共同標準。小組需要判斷哪一杯較可能變質，並決定還要補充哪些證據讓提醒更可靠。

> **Q1. [基礎證據題]**：「根據上述情境，目前哪一項證據最直接支持初步判斷？」
> (A) 只看哪杯比較順眼就決定提醒方式
> (B) 記下兩杯放置位置與外觀差異再比較
> (C) 同時比較味道、位置與時間，整理可能原因
> (D) 先設計另一組對照，確認變化是否穩定出現
> **教師解析**：A: -1 (只憑直覺，證據有限)；B: +1 (開始使用可見證據，屬萌芽)；C: +2 (能整合多個線索，接近發展)；D: +3 (主動規劃驗證，展現精熟傾向)。

> **Q2. [證據比較題]**：「延續上述飲料保存情境，若照片角度與觀察描述不一致，哪種判斷方式較可靠？」
> (A) 讓聲音最大的同學決定
> (B) 各自說出看到的差異後投票
> (C) 把觀察項目列成表格，再討論哪個證據最關鍵
> (D) 補拍照片並記錄時間，隔天用同一規準重新比較
> **教師解析**：A: +1 (缺少證據策略)；B: +2 (有討論但證據整理不足)；C: +3 (能用表格建立判斷依據)；D: +4 (能延伸蒐證並修正判斷流程)。

> **Q3. [改善遷移題]**：「仍針對同一飲料保存問題，若下次改成保存切好的水果，最能改善資料蒐集的是哪個做法？」
> (A) 直接沿用飲料的判斷，不再觀察新線索
> (B) 只比較顏色是否變深
> (C) 同時觀察氣味、顏色與放置環境，再比較變化
> (D) 先預測可能變化，設計照片與時間紀錄來驗證
> **教師解析**：A: +1 (遷移僵化)；B: +3 (能抓到部分線索但不足)；C: +5 (能跨情境整合證據)；D: +6 (能主動設計驗證並調整規準)。

> **Q4. [簡答鑑別題 - 發展 vs 精熟]**：「請說明你會如何提醒園遊會小組保存飲料。」
> 💡 回答引導：
> ① 【行動決策】：你會先做什麼？
> ② 【思維邏輯】：你依據哪些線索？
> ③ 【遷移調整】：若換成其他食物，你會怎麼改？
> **教師進程判定標準**：
> - **證據有限 (Evidence Limited)**：只依單一外觀或氣味下結論，未整理證據。
> - **萌芽 (Emerging)**：能提出提醒方向，但理由仍零散。
> - **發展 (Developing)**：能整合多個生活線索，整理證據後提出合理提醒。
> - **精熟 (Mastering)**：能設計可遷移的判斷規準，標示限制並規劃驗證。

**【統計規格與總分落點標準】**
Q1–Q3 總分 -1–13 分；-1–2 分為證據有限，3–6 分為萌芽，7–10 分為發展，11–13 分為精熟。

## 課後：轉折遷移

**【課後共用情境】**
完成「反應速率 - 硫粒子生成實驗」後，某小組把比較速率的方法轉用到飲料保存紀錄。他們用手機計時與照片對照追蹤三杯飲料的混濁變化，但第三杯照片顏色異常，時間紀錄也少了一格。小組需要判斷哪杯變化較快，並決定如何標記限制、補充證據，讓結論更可靠。

> **Q1. [基礎證據題]**：「根據課後情境，目前哪一項資料最需要先確認？」
> (A) 先問哪位組員比較有經驗，再依他的說法判斷
> (B) 先確認第三杯照片是否有紀錄時間與拍攝條件
> (C) 三杯資料是否能用同一比較規準檢查
> (D) 是否需要補做紀錄並標記資料限制
> **教師解析**：A: -1 (依賴權威，證據有限)；B: +1 (能注意單一證據條件)；C: +2 (能用共同規準比較)；D: +3 (能處理限制並規劃補證)。

> **Q2. [證據比較題]**：「延續上述課後飲料保存紀錄，若照片顏色異常與時間紀錄不一致，哪個策略最可靠？」
> (A) 直接刪掉照片避免麻煩
> (B) 保留照片但不納入討論
> (C) 標記拍攝限制，和其他時間紀錄一起判讀
> (D) 補拍、註記限制，並說明資料如何影響結論
> **教師解析**：A: +1 (忽略異常證據)；B: +2 (保存資料但未有效使用)；C: +3 (能整合限制與證據)；D: +4 (能修正策略並解釋影響)。

> **Q3. [改善遷移題]**：「仍針對同一組保存紀錄，若下次手機計時也出現誤差，最能改善蒐證並展現遷移的是哪個做法？」
> (A) 停止紀錄，改用印象判斷
> (B) 只相信照片，不使用時間資料
> (C) 比對照片、時間與觀察紀錄，找出誤差來源
> (D) 事先設計備援紀錄方式，並說明每種證據的限制
> **教師解析**：A: +1 (放棄證據)；B: +3 (使用部分證據但策略單一)；C: +5 (能整合多元證據)；D: +6 (能預先調整工具並遷移規準)。

> **Q4. [簡答鑑別題 - 課後發展 vs 精熟]**：「請說明你會如何處理顏色異常的照片。」
> 💡 回答引導：
> ① 【工具應用】：如何使用手機計時與照片對照？
> ② 【原理內化】：如何判斷證據可靠度？
> ③ 【高階遷移】：工具失效時如何調整？
> **教師進程判定標準**：
> - **證據有限 (Evidence Limited)**：只看單一照片或時間就下結論。
> - **萌芽 (Emerging)**：能提到工具限制，但未整合其他證據。
> - **發展 (Developing)**：能整理照片與時間紀錄，提出具體判斷步驟。
> - **精熟 (Mastering)**：能設計備援流程，說明限制並遷移到新情境驗證。

**【統計規格與總分落點標準】**
Q1–Q3 總分 -1–13 分；-1–2 分為證據有限，3–6 分為萌芽，7–10 分為發展，11–13 分為精熟。`;

const INVALID_MARKDOWN = VALID_MARKDOWN
  .replace("園遊會飲料保存小組", "反應速率 - 硫粒子生成實驗前，某小組")
  .replace("(D) 是否需要補做紀錄並標記資料限制", "(D) 以上皆是，所以直接合併所有資料當作結論")
  .replace("D: +3 (能處理限制並規劃補證)", "D: +9 (能處理限制並規劃補證)");

const args = parseArgs(process.argv.slice(2));
if (args.file) {
  const filePath = resolve(args.file);
  const markdown = await readFile(filePath, "utf8");
  const result = validateGeneratedMarkdown(markdown, DEFAULT_FORM);
  assertResult(filePath, result, true);
} else {
  assertResult("valid fixture", validateGeneratedMarkdown(VALID_MARKDOWN, DEFAULT_FORM), true);
  assertResult("invalid fixture", validateGeneratedMarkdown(INVALID_MARKDOWN, DEFAULT_FORM), false);
  const snapshotSource = await readFile(resolve("src/lib/__snapshots__/assessment-document.test.ts.snap"), "utf8");
  const snapshotMatch = snapshotSource.match(/= `\n"([\s\S]*)"\n`;\s*$/);
  if (!snapshotMatch) {
    console.error("品質 smoke test 失敗：無法讀取新版 Q4 snapshot");
    process.exitCode = 1;
  } else {
    assertScaffoldedQ4(snapshotMatch[1]);
  }
}
