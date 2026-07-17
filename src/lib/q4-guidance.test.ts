import { describe, expect, it } from "vitest";
import { renderAssessmentMarkdown } from "@/lib/assessment-document";
import { parseAssessmentModule, parseGuidedQ4Text } from "@/lib/parse-assessment";
import { getErrorTargets, validateGeneratedMarkdown } from "@/lib/validate-output";
import { normalizeDecisionTask, normalizeGeneratedQ4Markdown } from "@/lib/q4-guidance";
import {
  buildStrategyPromptBlock,
  getAssessmentStrategy,
  getGradeBand,
} from "@/lib/assessment-strategies";
import { splitModules } from "@/lib/markdown";
import { applyRefine } from "@/lib/markdown";
import { TEST_ASSESSMENT_DOCUMENT, TEST_FORM } from "@/test/assessment-fixture";

describe("Q4 guided progression contract", () => {
  it("normalizes missing, polite, and already-valid decision verbs deterministically", () => {
    expect(normalizeDecisionTask("哪一份紀錄較可信？")).toBe("判斷哪一份紀錄較可信");
    expect(normalizeDecisionTask("**請比較兩份紀錄：**")).toBe("比較兩份紀錄");
    expect(normalizeDecisionTask("學生需要確認資料是否一致")).toBe("確認資料是否一致");
    for (const task of [
      "判斷哪份資料可靠",
      "決定下一步做法",
      "比較兩份紀錄",
      "確認資料是否一致",
      "選擇主要證據",
    ]) {
      expect(normalizeDecisionTask(task)).toBe(task);
    }
    expect(normalizeDecisionTask("請：？")).toBe("");
  });

  it("parses same-line guide markers without leaking Markdown", () => {
    const guided = parseGuidedQ4Text(`兩份紀錄不一致，請依序回答。
**① 先說說你看到什麼**：兩份紀錄有哪些不同？
**② 再說說你怎麼判斷**：你會用哪個相同條件比較？
**③ 最後說說你會怎麼調整**：如果工具失效，你會如何調整並確認？`);

    expect(guided.steps).toHaveLength(3);
    expect(guided.scaffolded).toBe(false);
    expect(guided.steps.at(0)?.prompt).toBe("兩份紀錄有哪些不同？");
    expect(guided.steps.some((step) => step.prompt.includes("**"))).toBe(false);
  });

  it("normalizes Puter Q4 context markers through the deterministic scaffold builder", () => {
    const raw = `## 課前：思維診斷

**【課前共用情境】**
模型自行撰寫、稍後會被藍圖取代的情境。

> **Q1. [基礎證據題]**：「先查看哪份資料？」
> **Q4. [引導式簡答題]**
> **共用情境藍圖｜場景**：學生要比較兩份保存紀錄
> **Q4情境要素｜判斷任務**：哪一份紀錄較可信？
> **Q4情境要素｜證據A**：照片紀錄
> **共用情境藍圖｜證據A內容**：顯示第二天出現外觀變化
> **Q4情境要素｜證據B**：時間紀錄
> **共用情境藍圖｜證據B內容**：記載第三天才出現外觀變化
> **共用情境藍圖｜分歧**：外觀變化日期不一致
> **Q4情境要素｜比較重點**：觀察時間｜外觀變化
> **Q4情境要素｜新限制**：部分照片缺漏
> **教師進程判定標準**：
> - **證據有限 (Evidence Limited)**：只有結論，沒有證據。
>   - **學生可能回答**：「我覺得照片比較清楚。」
> - **萌芽 (Emerging)**：看見差異，但沒有公平比較。
>   - **學生可能回答**：「我看到兩份紀錄不一樣。」
> - **發展 (Developing)**：能用相同條件比較並說明理由。
>   - **學生可能回答**：「我會比較同一時間的兩份資料。」
> - **精熟 (Mastering)**：能處理限制並用另一份資料確認。
>   - **學生可能回答**：「我會改用文字記錄，再找另一份資料確認。」

**【統計規格與總分落點標準】**`;
    const normalized = normalizeGeneratedQ4Markdown(raw, TEST_FORM);

    expect(normalized).toContain("**① 概念理解**");
    expect(normalized).toContain("**② 行動應用**");
    expect(normalized).toContain("**③ 生活遷移**");
    expect(normalized).toContain("為了判斷哪一份紀錄較可信");
    expect(normalized).toContain('"decisionTask":"判斷哪一份紀錄較可信"');
    expect(normalized).toContain("**先看哪裡**");
    expect(normalized).toContain("**可以這樣開始**");
    expect(normalized).toContain("**萌芽 → 發展｜已跨界證據**");
    expect(normalized).not.toContain("Q4情境要素｜判斷任務");
  });

  it("normalizes decision tasks inside a restored canonical Markdown draft", () => {
    const canonical = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM);
    const invalidDraft = canonical.replaceAll(
      "判斷哪一份紀錄較能支持目前的結論",
      "哪一份紀錄較能支持目前的結論",
    );

    const normalized = normalizeGeneratedQ4Markdown(invalidDraft, TEST_FORM);

    expect(normalized).toBe(canonical);
    expect(validateGeneratedMarkdown(normalized, TEST_FORM).errors).toEqual([]);
  });

  it("replaces a Q4 refine target whose id already includes a period", () => {
    const original = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM);
    const updated = applyRefine(
      original,
      { type: "question", id: "Q4.", title: "Q4", currentContent: "" },
      "> **Q4. [引導式簡答題]**：替換成功",
    );

    expect(updated).toContain("> **Q4. [引導式簡答題]**：替換成功");
    expect(updated).not.toBe(original);
  });

  it("parses three student-facing steps and keeps teacher-only content separate", () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    const q4 = parseAssessmentModule(modules[1], "pre").questions.find((question) =>
      question.rawTitle.includes("Q4"),
    );
    expect(q4).toBeDefined();

    const guided = parseGuidedQ4Text(q4?.text ?? "");
    expect(guided.steps.map((step) => step.label)).toEqual([
      "概念理解",
      "行動應用",
      "生活遷移",
    ]);
    expect(guided.scaffolded).toBe(true);
    expect(guided.steps.every((step) => step.focusHint && step.sentenceStarter)).toBe(true);
    expect(q4?.text).not.toContain("教師系統判讀建議");
    expect(q4?.explanation).toContain("萌芽 → 發展｜已跨界證據");
    expect(q4?.explanation.match(/學生可能回答/g)).toHaveLength(4);
  });

  it("scopes a weak comparison prompt to only pre.q4", () => {
    const markdown = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM).replace(
      "為了判斷哪一份紀錄較能支持目前的結論，你會用哪一個相同條件比較兩份資料？請再用外觀變化、放置時間、紀錄日期中的具體內容說明判斷理由。",
      "你怎麼想？",
    );
    const validation = validateGeneratedMarkdown(markdown, TEST_FORM);

    expect(validation.errors).toContain("課前 Q4 第 2 步必須是 20–150 字的直接問句");
    expect(validation.errors).toContain("課前 Q4「行動應用」未同時引出可執行做法與理由");
    expect(getErrorTargets(validation)).toEqual(["pre.q4"]);
  });

  it("rejects teacher jargon and non-first-person student examples", () => {
    const markdown = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM)
      .replace("先說問題和兩個重要線索，不用猜老師想要的標準答案。", "請展現原理內化再開始回答。")
      .replace("我覺得照片看起來比較清楚", "學生覺得照片看起來比較清楚");
    const validation = validateGeneratedMarkdown(markdown, TEST_FORM);

    expect(validation.errors.some((error) => error.includes("原理內化"))).toBe(true);
    expect(validation.errors.some((error) => error.includes("學生回答範例必須使用第一人稱"))).toBe(true);
  });

  it("accepts the same guided progression contract in a non-science context", () => {
    const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    const socialQ4 = {
      ...document.post.q4,
      studentExamples: {
        evidenceLimited: "我覺得第一篇寫得比較完整，所以直接相信第一篇。",
        emerging: "我看到兩篇使用的年份不同，但還不知道哪一篇比較可信。",
        developing: "我會先比較相同年份的數字，再確認兩篇是否引用同一個原始來源。",
        mastering: "如果原始網頁失效，我會找官方封存資料和另一份獨立報導交叉比對，再說明目前判斷的限制。",
      },
    };
    const socialBlueprint = {
        setting: "班級要整理一項公共議題",
        contextFacts: ["兩組資料來自同一週", "資料使用相同分類名稱"] as [string, string],
        decisionTask: "判斷哪一篇報導較能支持目前的說法",
        evidenceA: { label: "第一篇報導", detail: "引用較早年份的數字" },
        evidenceB: { label: "第二篇報導", detail: "引用較晚年份的不同數字" },
        conflict: "引用年份與數字不一致",
        observationFocus: ["數字", "日期", "資料來源"] as [string, string, string],
        constraint: "原始網頁無法查看",
    };
    document.pre.q4 = socialQ4;
    document.post.q4 = structuredClone(socialQ4);
    document.pre.scenarioBlueprint = structuredClone(socialBlueprint);
    document.post.scenarioBlueprint = structuredClone(socialBlueprint);
    const form = {
      ...TEST_FORM,
      subject: "社會",
      activityName: "新聞資料可信度比較",
      tools: "資料來源表、時間軸",
    };

    expect(validateGeneratedMarkdown(renderAssessmentMarkdown(document, form), form).errors).toEqual([]);
  });

  it("routes C5-P3 to one idea-to-action ladder across Q1–Q4", () => {
    const form = {
      ...TEST_FORM,
      source: "資料庫" as const,
      indicatorId: "C5-P3",
      customIndicator: "",
    };
    const strategy = getAssessmentStrategy(form);
    const markdown = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, form);

    expect(strategy.id).toBe("idea_action_check");
    expect(markdown).toContain("[概念理解題]");
    expect(markdown).toContain("[行動應用題]");
    expect(markdown).toContain("[生活遷移題]");
    expect(markdown).toContain("把想法排成步驟");
    expect(markdown).toContain("第一步先＿＿，接著＿＿");
  });

  it("applies different student-language contracts to junior and senior grades", () => {
    const junior = { ...TEST_FORM, grade: "國二" };
    const senior = { ...TEST_FORM, grade: "高二" };

    expect(getGradeBand(junior.grade)).toBe("junior");
    expect(getGradeBand(senior.grade)).toBe("senior");
    expect(buildStrategyPromptBlock(junior)).toContain("每句只放一個主要意思");
    expect(buildStrategyPromptBlock(senior)).toContain("可保留必要課程名詞");
  });

  it("keeps every database dimension on a valid deterministic Q4 scaffold", () => {
    const representativeIds = [
      "C1-P1",
      "C1-P3",
      "C2-P1",
      "C3-P1",
      "C4-P1",
      "C5-P3",
      "C6-P1",
    ];

    for (const indicatorId of representativeIds) {
      const form = {
        ...TEST_FORM,
        source: "資料庫" as const,
        indicatorId,
        customIndicator: "",
      };
      const validation = validateGeneratedMarkdown(
        renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, form),
        form,
      );
      expect(validation.errors, `${indicatorId}: ${validation.errors.join("；")}`).toEqual([]);
    }
  });
});
