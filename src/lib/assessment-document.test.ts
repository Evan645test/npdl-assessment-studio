import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_DOCUMENT_SCHEMA,
  buildAssessmentPatchSchema,
  mergeAssessmentPatch,
  parseAssessmentDocument,
  parseAssessmentPatch,
  renderAssessmentMarkdown,
} from "@/lib/assessment-document";
import { validateGeneratedMarkdown } from "@/lib/validate-output";
import { TEST_ASSESSMENT_DOCUMENT, TEST_FORM } from "@/test/assessment-fixture";

describe("AssessmentDocument", () => {
  it("round-trips structured JSON and renders the stable Markdown contract", () => {
    const parsed = parseAssessmentDocument(JSON.stringify(TEST_ASSESSMENT_DOCUMENT));
    const markdown = renderAssessmentMarkdown(parsed, TEST_FORM);

    expect(markdown).toMatchSnapshot();
    expect(markdown.match(/^## /gm)).toHaveLength(3);
    expect(markdown.match(/> \*\*Q[1-4]\./g)).toHaveLength(8);
    expect(markdown.match(/> \([A-D]\)/g)).toHaveLength(24);
    expect(markdown).toContain("A: -1");
    expect(markdown).toContain("D: +6");
    expect(validateGeneratedMarkdown(markdown, TEST_FORM).errors).toEqual([]);
  });

  it("merges only the requested patch field", () => {
    const original = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    const replacement = {
      ...original.pre.scenarioBlueprint,
      setting: "修復後的課前生活任務",
    };
    const patchRaw = JSON.stringify({ pre: { scenarioBlueprint: replacement } });
    const patch = parseAssessmentPatch(patchRaw, ["pre.scenario"]);
    const merged = mergeAssessmentPatch(original, patch, ["pre.scenario"]);

    expect(merged.pre.scenarioBlueprint).toEqual(replacement);
    expect(merged.pre.q1).toEqual(original.pre.q1);
    expect(merged.post).toEqual(original.post);
    expect(buildAssessmentPatchSchema(["pre.scenario"])).toMatchObject({
      required: ["pre"],
      properties: { pre: { required: ["scenarioBlueprint"] } },
    });
  });

  it("requires one module blueprint instead of duplicated Q4 context", () => {
    const schema = ASSESSMENT_DOCUMENT_SCHEMA as {
      properties: {
        pre: { properties: { q4: { required: string[]; properties: Record<string, unknown> } } };
      };
    };
    const q4 = schema.properties.pre.properties.q4;
    const postQ4 = (ASSESSMENT_DOCUMENT_SCHEMA as any).properties.post.properties.q4;

    expect(q4.required).not.toContain("context");
    expect(q4.properties).not.toHaveProperty("guides");
    expect(q4.properties).not.toHaveProperty("transitionChecks");
    expect(postQ4.required).toEqual(expect.arrayContaining(["conceptAnnotations", "transferAnnotations"]));
    expect((ASSESSMENT_DOCUMENT_SCHEMA as any).properties.pre.properties.scenarioBlueprint).toMatchObject({
      required: ["setting", "contextFacts", "evidenceA", "evidenceB", "conflict", "decisionTask", "observationFocus", "constraint"],
    });
  });

  it("does not create phrase-order false positives and reports a missing activity only once", () => {
    const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    document.pre.scenarioBlueprint = {
      setting: "兩盒草莓分別放在常溫與冷藏環境，學生要判斷哪一種保存方式較穩定",
      contextFacts: [
        "兩盒草莓同一天開始觀察，每天固定在放學前記錄一次",
        "兩組使用相同的外觀變化表，但拍照距離略有不同",
      ],
      evidenceA: { label: "常溫盒與冷藏盒的照片", detail: "兩盒顏色在不同日期出現改變" },
      evidenceB: { label: "兩盒草莓出現軟斑的日期紀錄", detail: "軟斑日期與照片顯示的變化順序不同" },
      conflict: "草莓顏色、軟斑與觀察日期的先後順序不一致",
      decisionTask: "判斷哪份資料較能支持保存方式的比較",
      observationFocus: ["草莓顏色", "草莓軟斑", "觀察日期"],
      constraint: "觀察時間只剩一天",
    };
    const markdown = renderAssessmentMarkdown(document, TEST_FORM);
    const valid = validateGeneratedMarkdown(markdown, TEST_FORM);

    expect(valid.errors).toEqual([]);
    expect(valid.warnings).toEqual([]);

    const withoutActivity = markdown.replace(`完成「${TEST_FORM.activityName}」後，`, "完成課堂活動後，");
    const activityErrors = validateGeneratedMarkdown(withoutActivity, TEST_FORM).errors.filter((error) =>
      error.includes("活動名稱"),
    );
    expect(activityErrors).toEqual([
      "課後情境必須明確提及活動名稱，呈現已完成課堂活動後的遷移",
    ]);
  });

  it("rejects a decision task that becomes empty after normalization", () => {
    const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    document.pre.scenarioBlueprint.decisionTask = "請：？";

    expect(() => parseAssessmentDocument(JSON.stringify(document))).toThrow(
      "pre.scenarioBlueprint.decisionTask 正規化後不可為空",
    );
  });

  it("requires new post-analysis notes while still allowing legacy draft restoration", () => {
    const legacy = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    delete legacy.post.q4.conceptAnnotations;
    delete legacy.post.q4.transferAnnotations;
    const raw = JSON.stringify(legacy);

    expect(() => parseAssessmentDocument(raw)).toThrow(
      "post.q4.conceptAnnotations 必須完整提供",
    );
    expect(() =>
      parseAssessmentDocument(raw, { allowLegacyPostAnnotations: true }),
    ).not.toThrow();
  });

  it("treats model-provided Markdown and HTML as plain data, never as App layout", () => {
    const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    document.pre.q1.stem = "## 偽標題 **請判斷** <script>破壞版型</script>";
    document.pre.q1.options[0].text = "[外部連結](https://example.com) 與 `程式碼`";
    document.pre.scenarioBlueprint.contextFacts[0] = "**背景事實** <style>body{display:none}</style>";

    const markdown = renderAssessmentMarkdown(document, TEST_FORM);
    expect(markdown.match(/^## /gm)).toHaveLength(3);
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("<style>");
    expect(markdown).not.toContain("**背景事實**");
    expect(markdown).toContain("外部連結 與 程式碼");
  });
});
