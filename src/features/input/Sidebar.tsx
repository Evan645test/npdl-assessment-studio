import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Loader2, Sparkles, Upload } from "lucide-react";
import { COMPETENCY_DIMENSIONS, COURSE_CONTEXT_TEMPLATES, GRADES, SUBJECT_CHIPS } from "@/data/constants";
import { getIndicatorsByDimension } from "@/data/indicators";
import { t } from "@/locales/zh-Hant";
import type { CourseForm, IdeationResult, Indicator } from "@/types";

interface SidebarProps {
  form: CourseForm;
  updateForm: (patch: Partial<CourseForm>) => void;
  indicatorName?: string;
  hasIndicator: boolean;
  hasActivity: boolean;
  hasContext: boolean;
  canGenerate: boolean;
  generating: boolean;
  ideation: IdeationResult | null;
  ideating: boolean;
  ideationNotice: string | null;
  onIdeate: () => void;
  onGenerate: () => void;
  onJumpStep: (step: number) => void;
  mobileStep: number;
  setMobileStep: (step: number) => void;
  pdfName: string;
  onPdfSelect: (file: File | null) => void;
  appendKeyword: (field: "lifeKeywords" | "tools", value: string) => void;
  isMobile: boolean;
}

const FIELD_HINTS: Record<string, string> = {
  grade: "選擇這堂課對應的學段。",
  subject: "可點選下方常見科目，或自行輸入。",
  activityName: "寫出學生會做的活動，而不是只寫單元名稱。",
  lifeKeywords: "用學生課前就看得到的生活現象，避免只填課本術語。",
  tools: "填入能留下證據的工具，例如時間、照片、紀錄或討論材料。",
  customIndicator: "描述這堂課要對準的學習表現。",
};

function stepComplete(step: number, hasIndicator: boolean, hasCourseContext: boolean) {
  if (step === 1) return hasCourseContext;
  if (step === 2) return hasIndicator;
  if (step === 3) return hasCourseContext && hasIndicator;
  return false;
}

function activeStep(hasIndicator: boolean, hasCourseContext: boolean) {
  if (!hasCourseContext) return 1;
  if (!hasIndicator) return 2;
  return 3;
}

const DIMENSION_KEYWORDS: Record<string, string[]> = {
  品格: ["責任", "堅持", "誠實", "自律", "反思", "失敗", "態度", "尊重", "同理", "承諾"],
  公民素養: ["社區", "公共", "公平", "規範", "永續", "環境", "公民", "權利", "影響", "議題"],
  協作: ["小組", "合作", "分工", "共識", "討論", "同儕", "團隊", "協調", "互評", "角色"],
  溝通: ["說明", "表達", "報告", "分享", "簡報", "訪談", "文字", "口頭", "聽眾", "回饋"],
  批判思考: ["觀察", "證據", "資料", "數據", "比較", "判斷", "推論", "分析", "實驗", "變因", "紀錄", "照片", "計時", "對照", "反應", "速率", "腐敗", "氣味"],
  創造力: ["設計", "發想", "原型", "改造", "創作", "方案", "替代", "優化", "模型", "提案"],
};

const DIMENSION_REASONS: Record<string, string> = {
  品格: "活動脈絡涉及責任、自律或反思，可以觀察學生如何面對任務品質與學習態度。",
  公民素養: "活動脈絡連到公共議題、規範或環境影響，可以觀察學生如何考量群體與社會面向。",
  協作: "活動脈絡需要分工、討論或共識形成，可以觀察學生如何讓小組工作更有效。",
  溝通: "活動脈絡需要清楚表達、說明或回應聽眾，可以觀察學生如何組織並傳達想法。",
  批判思考: "活動脈絡需要觀察證據、比較資料與提出判斷理由，可以降低情境過度戲劇化的風險。",
  創造力: "活動脈絡需要發想、設計或改良方案，可以觀察學生如何提出可行的新做法。",
};

const HEX_POINTS = [
  [60, 30],
  [140, 30],
  [180, 100],
  [140, 170],
  [60, 170],
  [20, 100],
] as const;

const HEX_LABEL_POSITIONS = [
  [100, 60],
  [138, 82],
  [138, 124],
  [100, 146],
  [62, 124],
  [62, 82],
] as const;

function hexSlicePoints(index: number) {
  const first = HEX_POINTS[index];
  const second = HEX_POINTS[(index + 1) % HEX_POINTS.length];
  return `100,100 ${first[0]},${first[1]} ${second[0]},${second[1]}`;
}

function normalizedContext(form: CourseForm) {
  return [form.grade, form.subject, form.activityName, form.lifeKeywords, form.tools].join(" ").toLowerCase();
}

function keywordScore(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 2 : 0), 0);
}

function recommendDimensions(form: CourseForm) {
  const text = normalizedContext(form);
  return COMPETENCY_DIMENSIONS.map((dimension, index) => ({
    ...dimension,
    score: keywordScore(text, DIMENSION_KEYWORDS[dimension.id] ?? []) + (dimension.id === "批判思考" ? 1 : 0) - index * 0.01,
  })).sort((a, b) => b.score - a.score);
}

function recommendIndicatorsForDimension(dimension: string, form: CourseForm, indicators: Indicator[]) {
  const text = normalizedContext(form);
  const contextTerms = text.split(/[、,，\s-]+/).filter((part) => part.length >= 2);
  return indicators
    .filter((indicator) => indicator.dimension === dimension)
    .map((indicator, index) => {
      const levels = Object.values(indicator.levels).join(" ");
      const indicatorText = `${indicator.name} ${levels}`.toLowerCase();
      const score =
        keywordScore(text, DIMENSION_KEYWORDS[indicator.dimension] ?? []) +
        keywordScore(indicatorText, contextTerms) -
        index * 0.01;
      return { indicator, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ indicator }) => indicator);
}

export function Sidebar({
  form,
  updateForm,
  indicatorName,
  hasIndicator,
  hasActivity,
  hasContext,
  canGenerate,
  generating,
  ideation,
  ideating,
  ideationNotice,
  onIdeate,
  onGenerate,
  onJumpStep,
  mobileStep,
  setMobileStep,
  pdfName,
  onPdfSelect,
  appendKeyword,
  isMobile,
}: SidebarProps) {
  const [dimension, setDimension] = useState<string>(COMPETENCY_DIMENSIONS[4].id);
  const hasTools = form.tools.trim().length > 0;
  const hasCourseContext = hasActivity && hasContext && hasTools;
  const indicators = useMemo(() => getIndicatorsByDimension(dimension), [dimension]);
  const recommendedDimensions = useMemo(() => recommendDimensions(form), [form]);
  const recommendedDimension = recommendedDimensions[0];
  const recommendedIndicators = useMemo(
    () => recommendIndicatorsForDimension(recommendedDimension.id, form, getIndicatorsByDimension(recommendedDimension.id)),
    [form, recommendedDimension.id],
  );
  const topRecommendedIndicator = recommendedIndicators[0];
  const current = activeStep(hasIndicator, hasCourseContext);
  const preflightItems = [
    { ok: hasActivity, label: t.preflight.activity, step: 1 },
    { ok: hasContext && hasTools, label: t.preflight.context, step: 1 },
    { ok: hasIndicator, label: t.preflight.indicator, step: 2 },
  ];
  const pendingPreflight = preflightItems.filter((item) => !item.ok);

  const showStep = (step: number) => !isMobile || mobileStep === step;
  const applyRecommendation = () => {
    setDimension(recommendedDimension.id);
    if (topRecommendedIndicator) {
      updateForm({ source: "資料庫", indicatorId: topRecommendedIndicator.id });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dfe8e2] bg-[#f7faf8] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">步驟 {current}/3</p>
        <p className="mt-1 truncate text-sm font-black text-zinc-900">
          {[form.subject, form.activityName, indicatorName].filter(Boolean).join(" · ") || "尚未完成設定"}
        </p>
      </div>

      {!isMobile && (
        <nav className="flex gap-1 border-b border-[#dfe8e2] bg-white p-2" aria-label="課程設定進度">
          {t.stepLabels.map((label, index) => {
            const step = index + 1;
            const done = stepComplete(step, hasIndicator, hasCourseContext);
            const isActive = step === current;
            return (
              <button
                key={label}
                type="button"
                aria-current={isActive ? "step" : undefined}
                onClick={() => {
                  onJumpStep(step);
                  if (isMobile) setMobileStep(step);
                }}
                className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-[10px] font-black transition ${
                  done
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : isActive
                      ? "bg-[#fff4db] text-[#8a5a12] ring-1 ring-[#f1d28a]"
                      : "bg-[#f4f7f5] text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {showStep(1) && (
          <section className="rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-[0_1px_10px_rgba(15,45,38,0.04)]">
            <h2 className="mb-1 text-sm font-black text-zinc-900">步驟 1 · 課程脈絡設定</h2>
            <p className="mb-3 text-xs font-bold text-zinc-500">先提供課程活動、生活內容與可用工具，讓後續指標推薦有明確依據。</p>
            <div className="mb-3 rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">快速套用範本</p>
              <div className="mt-2 grid gap-2">
                {COURSE_CONTEXT_TEMPLATES.map((template) => {
                  const isActive =
                    form.subject === template.patch.subject &&
                    form.activityName === template.patch.activityName &&
                    form.lifeKeywords === template.patch.lifeKeywords &&
                    form.tools === template.patch.tools;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => updateForm(template.patch)}
                      className={`rounded-xl border px-3 py-2 text-left ${
                        isActive
                          ? "border-[#173f36] bg-[#173f36] text-white shadow-sm shadow-emerald-950/15"
                          : "border-[#dfe8e2] bg-white text-zinc-700 hover:border-[#b9ccc2] hover:bg-[#fbfdfc]"
                      }`}
                    >
                      <p className="text-xs font-black">{template.label}</p>
                      <p className={`mt-0.5 text-[10px] font-bold ${isActive ? "text-emerald-100" : "text-zinc-500"}`}>
                        {template.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mb-3 block">
              <span className="text-xs font-black text-zinc-600">年級</span>
              <select
                value={form.grade}
                onChange={(e) => updateForm({ grade: e.target.value })}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                aria-label={FIELD_HINTS.grade}
              >
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>

            <label className="mb-2 block">
              <span className="text-xs font-black text-zinc-600">科目</span>
              <input
                value={form.subject}
                onChange={(e) => updateForm({ subject: e.target.value })}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                aria-label={FIELD_HINTS.subject}
              />
            </label>

            <div className="mb-3 flex flex-wrap gap-2">
              {SUBJECT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => updateForm({ subject: chip })}
                  className="rounded-full border border-[#dfe8e2] bg-white px-3 py-1 text-xs font-black text-zinc-600 hover:border-[#b7791f] hover:bg-[#fff8e8] hover:text-[#7a4d0b]"
                >
                  {chip}
                </button>
              ))}
            </div>

            <label className="mb-4 block">
              <span className="text-xs font-black text-zinc-600">活動名稱</span>
              <input
                value={form.activityName}
                onChange={(e) => updateForm({ activityName: e.target.value })}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1 text-[10px] font-bold text-zinc-500">{FIELD_HINTS.activityName}</p>
            </label>

            <div className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-3">
              <h3 className="text-sm font-black text-zinc-900">生活內容與工具</h3>
              <label className="mt-3 block">
                <span className="text-xs font-black text-zinc-600">生活現象關鍵字</span>
                <input
                  value={form.lifeKeywords}
                  onChange={(e) => updateForm({ lifeKeywords: e.target.value })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-1 text-[10px] font-bold text-zinc-500">{FIELD_HINTS.lifeKeywords}</p>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-black text-zinc-600">工具與證據</span>
                <input
                  value={form.tools}
                  onChange={(e) => updateForm({ tools: e.target.value })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-1 text-[10px] font-bold text-zinc-500">{FIELD_HINTS.tools}</p>
              </label>
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-[#e1bf69] bg-[#fff8e8] p-4">
              <h3 className="text-sm font-black text-zinc-900">AI 輔助發想</h3>
              <p className="mb-3 text-xs font-bold text-zinc-600">依活動名稱產生可點選的生活現象與工具關鍵字。</p>
              <button
                type="button"
                onClick={onIdeate}
                disabled={ideating || !form.activityName.trim()}
                className="rounded-xl bg-[#173f36] px-4 py-2 text-xs font-black text-white shadow-sm shadow-emerald-950/15 hover:bg-[#0f312a] disabled:opacity-40"
              >
                {ideating ? "產生中…" : "產生參考關鍵字"}
              </button>
              {ideationNotice && (
                <p className="mt-3 rounded-xl border border-[#edd28f] bg-white/80 px-3 py-2 text-xs font-bold text-[#7a4d0b]">{ideationNotice}</p>
              )}
              {ideation && (
                <div className="mt-3 space-y-3">
                  {[
                    { title: "生活現象參考", field: "lifeKeywords" as const, items: ideation.lifeKeywords },
                    { title: "工具建議", field: "tools" as const, items: ideation.tools },
                  ].map(({ title, field, items }) => (
                    <div key={title}>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#9a6617]">{title}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((chip) => {
                          const used = form[field].includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => appendKeyword(field, chip)}
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                used
                                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                  : "bg-white text-zinc-700 ring-1 ring-[#dfe8e2] hover:ring-[#b9ccc2]"
                              }`}
                            >
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <details className="mt-3 rounded-xl border border-[#dfe8e2] bg-[#f7faf8]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-black text-zinc-700">
                選填：上傳教案 PDF 作為生成參考
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="border-t border-[#dfe8e2] px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-600">
                  <Upload className="h-4 w-4" />
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => onPdfSelect(e.target.files?.[0] ?? null)}
                  />
                  選擇 PDF 檔案
                </label>
                {pdfName && <p className="mt-2 text-xs font-black text-[#9a6617]">已選：{pdfName}</p>}
              </div>
            </details>
          </section>
        )}

        {showStep(2) && (
          <section className="rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-[0_1px_10px_rgba(15,45,38,0.04)]">
            <h2 className="mb-1 text-sm font-black text-zinc-900">步驟 2 · 推薦與選擇指標</h2>
            <p className="mb-3 text-xs font-bold text-zinc-500">系統先依課程脈絡推薦方向，老師仍可用六邊形自由改選或改用自訂指標。</p>

            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">AI 建議方向</p>
                  <p className="mt-1 text-sm font-black text-emerald-950">
                    {recommendedDimension.mark} {recommendedDimension.id}
                    {topRecommendedIndicator ? ` · ${topRecommendedIndicator.name}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applyRecommendation}
                  className="shrink-0 rounded-xl bg-[#173f36] px-3 py-2 text-xs font-black text-white shadow-sm shadow-emerald-950/15 hover:bg-[#0f312a]"
                >
                  套用建議
                </button>
              </div>
              <p className="mt-2 text-xs font-bold leading-relaxed text-emerald-900">{DIMENSION_REASONS[recommendedDimension.id]}</p>
              {recommendedIndicators.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendedIndicators.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDimension(item.dimension);
                        updateForm({ source: "資料庫", indicatorId: item.id });
                      }}
                      className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-100 hover:ring-emerald-300"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <svg
              className="dimension-hex-map mb-3"
              viewBox="0 0 200 200"
              role="radiogroup"
              aria-label="核心能力向度"
            >
              {COMPETENCY_DIMENSIONS.map((d, index) => (
                <g
                  key={d.id}
                  role="radio"
                  tabIndex={0}
                  aria-checked={dimension === d.id}
                  aria-label={`${d.mark} ${d.id}`}
                  onClick={() => setDimension(d.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDimension(d.id);
                    }
                  }}
                  className={`dimension-hex-slice ${dimension === d.id ? "is-active" : ""}`}
                  style={{ "--dimension-color": d.color } as CSSProperties}
                >
                  <title>{`${d.mark} ${d.id}`}</title>
                  <polygon className="dimension-hex-wedge" points={hexSlicePoints(index)} />
                  <text
                    className="dimension-hex-text"
                    x={HEX_LABEL_POSITIONS[index][0]}
                    y={HEX_LABEL_POSITIONS[index][1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan className="dimension-hex-mark" x={HEX_LABEL_POSITIONS[index][0]} dy="-0.35em">
                      {d.mark}
                    </tspan>
                    <tspan className="dimension-hex-label" x={HEX_LABEL_POSITIONS[index][0]} dy="1.25em">
                      {d.id}
                    </tspan>
                  </text>
                </g>
              ))}
              <polygon className="dimension-hex-outline" points={HEX_POINTS.map(([x, y]) => `${x},${y}`).join(" ")} />
              <circle className="dimension-hex-center" cx="100" cy="100" r="12" />
            </svg>

            <div className="mb-3 flex rounded-xl border border-[#dfe8e2] bg-[#eef4f0] p-1">
              {(["資料庫", "自訂"] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => updateForm({ source })}
                  className={`flex-1 rounded-lg py-2 text-xs font-black ${
                    form.source === source ? "bg-white text-[#173f36] shadow-sm" : "text-zinc-500"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>

            {form.source === "資料庫" ? (
              <div className="max-h-56 space-y-2 overflow-y-auto custom-scrollbar">
                {indicators.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateForm({ indicatorId: item.id })}
                    className={`w-full rounded-xl border p-3 text-left ${
                      form.indicatorId === item.id
                        ? "border-[#173f36] bg-[#173f36] text-white shadow-sm shadow-emerald-950/15"
                        : "border-[#dfe8e2] bg-[#f7faf8] text-zinc-700 hover:border-[#b9ccc2] hover:bg-white"
                    }`}
                  >
                    <p className="text-xs font-black">{item.name}</p>
                    <p className={`mt-1 line-clamp-2 text-[10px] font-bold ${form.indicatorId === item.id ? "text-emerald-100" : "text-zinc-500"}`}>
                      {item.levels.emerging.slice(0, 48)}…
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={form.customIndicator}
                onChange={(e) => updateForm({ customIndicator: e.target.value })}
                placeholder="描述子指標學習表現…"
                className="min-h-28 w-full rounded-xl border border-[#dfe8e2] bg-white p-3 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                aria-label={FIELD_HINTS.customIndicator}
              />
            )}

            {hasIndicator && indicatorName && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">已選指標</p>
                <p className="text-sm font-black text-emerald-950">{indicatorName}</p>
              </div>
            )}
          </section>
        )}

        {showStep(3) && (
          <section className="rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-[0_1px_10px_rgba(15,45,38,0.04)] lg:hidden">
            <h2 className="text-sm font-black text-zinc-900">步驟 3 · 生成</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">確認課程脈絡與指標後即可生成。</p>
          </section>
        )}
      </div>

      {isMobile && (
        <div className="flex items-center justify-between border-t border-[#dfe8e2] px-4 py-2">
          <button
            type="button"
            disabled={mobileStep <= 1}
            onClick={() => setMobileStep(mobileStep - 1)}
            className="min-h-11 rounded-xl px-4 text-xs font-black text-zinc-600 disabled:opacity-30"
          >
            上一步
          </button>
          <span className="text-xs font-black text-zinc-500">步驟 {mobileStep}/3</span>
          <button
            type="button"
            disabled={mobileStep >= 3}
            onClick={() => setMobileStep(mobileStep + 1)}
            className="min-h-11 rounded-xl px-4 text-xs font-black text-zinc-600 disabled:opacity-30"
          >
            下一步
          </button>
        </div>
      )}

      <div className="sticky bottom-0 border-t border-[#dfe8e2] bg-white/95 p-4 shadow-[0_-6px_18px_rgba(15,45,38,0.05)] backdrop-blur-md">
        <div className="mb-3 text-xs font-bold">
          {pendingPreflight.length === 0 ? (
            <p className="flex items-center gap-2 text-emerald-700">
              <span>✓</span>
              設定完整，可以生成
            </p>
          ) : (
            <ul className="space-y-1">
              {pendingPreflight.map(({ label, step }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="text-zinc-300">○</span>
                  <button
                    type="button"
                    className="text-zinc-600 underline-offset-2 hover:text-[#173f36] hover:underline"
                    onClick={() => {
                      onJumpStep(step);
                      if (isMobile) setMobileStep(step);
                    }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173f36] text-sm font-black text-white shadow-lg shadow-emerald-950/15 hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? t.generating : t.generate}
        </button>
      </div>
    </div>
  );
}
