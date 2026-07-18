import { describe, expect, it } from "vitest";
import { buildTaiwanHighSchoolLabPrompt } from "@/lib/taiwan-high-school-context";

describe("Taiwan high-school laboratory context", () => {
  it.each([
    ["物理", ["力學小車", "數位萬用電表"], "燒杯、試管"],
    ["化學", ["燒杯、試管", "電子天平", "廢液分類"], "複式光學顯微鏡"],
    ["生物", ["複式光學顯微鏡", "預製玻片"], "氣墊軌道"],
    ["地科", ["岩石與礦物標本", "中央氣象署", "星座盤"], "分光光度計"],
  ])(
    "provides a conservative %s laboratory catalog",
    (subject, expectedItems, excludedItem) => {
      const prompt = buildTaiwanHighSchoolLabPrompt(subject);
      for (const item of expectedItems) expect(prompt).toContain(item);
      expect(prompt).toContain("仍須教師確認數量與可用狀態");
      expect(prompt).toContain("等效替代方案");
      expect(prompt).not.toContain(excludedItem);
    },
  );

  it("does not inject specialist laboratory equipment into unrelated subjects", () => {
    const prompt = buildTaiwanHighSchoolLabPrompt("地理");
    expect(prompt).toContain("未指定物理、化學、生物或地球科學實驗室");
    expect(prompt).not.toContain("分光光度計");
    expect(prompt).not.toContain("複式光學顯微鏡");
  });

  it("supports an integrated natural-science course without treating equipment as guaranteed", () => {
    const prompt = buildTaiwanHighSchoolLabPrompt("自然科學探究與實作");
    expect(prompt).toContain("力學小車");
    expect(prompt).toContain("燒杯、試管");
    expect(prompt).toContain("複式光學顯微鏡");
    expect(prompt).toContain("岩石與礦物標本");
    expect(prompt).toContain("不代表本校一定具備");
  });
});
