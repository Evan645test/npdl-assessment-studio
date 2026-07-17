import { describe, expect, it, vi } from "vitest";
import { generateAssessment, type AssessmentGenerateFn } from "@/lib/assessment-generation";
import { renderAssessmentMarkdown } from "@/lib/assessment-document";
import { TEST_ASSESSMENT_DOCUMENT, TEST_FORM } from "@/test/assessment-fixture";

const input = {
  form: TEST_FORM,
  indicator: null,
  model: "gpt-4.1",
  geminiKey: "",
  openaiKey: "test",
  xaiKey: "",
};

describe("generateAssessment request budget and repair", () => {
  it("uses the same structured document contract for Puter without adding a request", async () => {
    const canonical = renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM);
    const generate = vi.fn<AssessmentGenerateFn>().mockResolvedValue(JSON.stringify(TEST_ASSESSMENT_DOCUMENT));

    const result = await generateAssessment({ ...input, model: "puter:gemini-3.1-flash-lite", openaiKey: "" }, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.repairUsed).toBe(false);
    expect(result.repairStatus).toBe("not_needed");
    expect(result.validation.errors).toEqual([]);
    expect(result.markdown).toBe(canonical);
    expect(generate.mock.calls[0][0]).toMatchObject({
      stable: expect.stringContaining("只可輸出一個符合下列 JSON Schema 的 JSON 物件"),
    });
  });

  it("uses one request when structured output passes validation", async () => {
    const generate = vi.fn<AssessmentGenerateFn>().mockResolvedValue(
      JSON.stringify(TEST_ASSESSMENT_DOCUMENT),
    );
    const result = await generateAssessment(input, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.repairUsed).toBe(false);
    expect(result.repairStatus).toBe("not_needed");
    expect(result.validation.errors).toEqual([]);
    expect(result.markdown).toBe(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
  });

  it.each([
    ["OpenAI", "gpt-4.1"],
    ["Gemini", "gemini-2.5-pro"],
    ["Grok", "grok-4.5"],
  ])("normalizes both Q4 decision tasks before validating %s structured output", async (_provider, model) => {
    const generated = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    generated.pre.scenarioBlueprint.decisionTask = "哪一份紀錄較能支持目前的結論？";
    generated.post.scenarioBlueprint.decisionTask = "請比較哪一份紀錄較能支持目前的結論";
    const generate = vi.fn<AssessmentGenerateFn>().mockResolvedValue(JSON.stringify(generated));

    const result = await generateAssessment(
      { ...input, model, geminiKey: "test", xaiKey: "test" },
      generate,
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.repairUsed).toBe(false);
    expect(result.repairStatus).toBe("not_needed");
    expect(result.validation.errors).toEqual([]);
    expect(result.markdown).toContain('"decisionTask":"判斷哪一份紀錄較能支持目前的結論"');
    expect(result.markdown).toContain('"decisionTask":"比較哪一份紀錄較能支持目前的結論"');
  });

  it("normalizes cue-free Q1–Q3 stems before validation without a repair request", async () => {
    const generated = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    for (const type of ["pre", "post"] as const) {
      generated[type].q1.stem = "面對這些資料時，哪一項最值得先注意";
      generated[type].q2.stem = "面對這些資料時，哪一項最適合";
      generated[type].q3.stem = "面對這些資料時，哪一項最可靠";
    }
    const generate = vi.fn<AssessmentGenerateFn>().mockResolvedValue(JSON.stringify(generated));

    const result = await generateAssessment(input, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.repairUsed).toBe(false);
    expect(result.repairStatus).toBe("not_needed");
    expect(result.validation.errors).toEqual([]);
    expect(result.document.pre.q1.stem).toContain("哪一項最值得先注意");
    expect(result.document.pre.q1.stem).toContain("理解目前的問題");
    expect(result.document.pre.q3.stem).toContain("新的生活情境");
    expect(result.document.post.q3.stem).toContain("哪一項最可靠");
    expect(result.document.pre.q1.options).toEqual(generated.pre.q1.options);
  });

  it("repairs only the failing field and never sends requests in parallel", async () => {
    const broken = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    broken.pre.scenarioBlueprint.setting = `實驗室預告：${broken.pre.scenarioBlueprint.setting}`;
    const repairedBlueprint = structuredClone(TEST_ASSESSMENT_DOCUMENT.pre.scenarioBlueprint);
    repairedBlueprint.decisionTask = "哪一份紀錄較能支持目前的結論？";
    let active = 0;
    let maxActive = 0;
    const responses = [
      JSON.stringify(broken),
      JSON.stringify({ pre: { scenarioBlueprint: repairedBlueprint } }),
    ];
    const generate = vi.fn<AssessmentGenerateFn>().mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      const response = responses.shift();
      active -= 1;
      if (!response) throw new Error("unexpected third request");
      return response;
    });

    const result = await generateAssessment(input, generate);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    expect(result.repairUsed).toBe(true);
    expect(result.repairStatus).toBe("succeeded");
    expect(result.validation.errors).toEqual([]);
    expect(result.markdown).toBe(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    const secondOptions = generate.mock.calls[1][5];
    expect(secondOptions?.structured?.schema).toMatchObject({
      required: ["pre"],
      properties: { pre: { required: ["scenarioBlueprint"] } },
    });
  });

  it("spends the only repair request on full recovery after a schema parse failure", async () => {
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce("not valid JSON")
      .mockResolvedValueOnce(JSON.stringify(TEST_ASSESSMENT_DOCUMENT));

    const result = await generateAssessment(input, generate);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairUsed).toBe(true);
    expect(result.repairStatus).toBe("succeeded");
    expect(result.validation.errors).toEqual([]);
    expect(generate.mock.calls[1][5]?.progressPhase).toBe("repairing");
  });

  it("provides the shared blueprint as read-only context during a scoped Q4 repair", async () => {
    const broken = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    broken.pre.q4.studentExamples.evidenceLimited = "學生直接相信第一份資料。";
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce(JSON.stringify(broken))
      .mockResolvedValueOnce(JSON.stringify({ pre: { q4: TEST_ASSESSMENT_DOCUMENT.pre.q4 } }));

    const result = await generateAssessment(input, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairUsed).toBe(true);
    expect(result.repairStatus).toBe("succeeded");
    expect(result.validation.errors).toEqual([]);
    expect(JSON.stringify(generate.mock.calls[1][0])).toContain("唯讀共用情境藍圖");
    expect(JSON.stringify(generate.mock.calls[1][0])).toContain("每日照片");
  });

  it("rejects a repair that swaps the original error for a new error", async () => {
    const broken = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    broken.pre.scenarioBlueprint.setting = `實驗室預告：${broken.pre.scenarioBlueprint.setting}`;
    const stillBroken = structuredClone(TEST_ASSESSMENT_DOCUMENT.pre.scenarioBlueprint);
    stillBroken.setting = `本堂課預告：${stillBroken.setting}`;
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce(JSON.stringify(broken))
      .mockResolvedValueOnce(JSON.stringify({ pre: { scenarioBlueprint: stillBroken } }));

    const result = await generateAssessment(input, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairUsed).toBe(true);
    expect(result.repairStatus).toBe("failed");
    expect(result.document.pre.scenarioBlueprint.setting).toContain("實驗室預告");
    expect(result.validation.errors).toContain(
      "課前情境出現課程洩漏詞「實驗室」，不符合零課程詞彙",
    );
    expect(result.validation.errors.some((error) => error.includes("本堂課"))).toBe(false);
  });

  it("reports a failed quality repair when the patch cannot be parsed", async () => {
    const broken = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    broken.pre.scenarioBlueprint.setting = `實驗室預告：${broken.pre.scenarioBlueprint.setting}`;
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce(JSON.stringify(broken))
      .mockResolvedValueOnce("not valid patch json");

    const result = await generateAssessment(input, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairUsed).toBe(true);
    expect(result.repairStatus).toBe("failed");
    expect(result.document.pre.scenarioBlueprint.setting).toContain("實驗室預告");
    expect(result.validation.ok).toBe(false);
  });

  it("stops after two requests and preserves both parse errors in the message", async () => {
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce("first invalid")
      .mockResolvedValueOnce("second invalid");

    await expect(generateAssessment(input, generate)).rejects.toThrow(
      /原始錯誤：.*修復錯誤：/,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
