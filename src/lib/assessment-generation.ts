import {
  ASSESSMENT_DOCUMENT_SCHEMA,
  buildAssessmentPatchSchema,
  mergeAssessmentPatch,
  parseAssessmentDocument,
  parseAssessmentPatch,
  renderAssessmentMarkdown,
  selectAssessmentPatchSource,
  selectAssessmentRepairContext,
} from "@/lib/assessment-document";
import {
  generateContent,
  type GenerationOptions,
  type GenerationPromptParts,
} from "@/lib/ai/client";
import {
  buildStructuredGeneratePrompt,
  buildStructuredRecoveryPrompt,
  buildStructuredRepairPrompt,
} from "@/prompts";
import {
  getErrorTargets,
  validateGeneratedMarkdown,
  type ValidationResult,
} from "@/lib/validate-output";
import { normalizeAssessmentQuestionStems } from "@/lib/question-contracts";
import type { AssessmentDocument, CourseForm, GenerationProgress, Indicator } from "@/types";

export type AssessmentGenerateFn = (
  prompt: string | GenerationPromptParts,
  model: string,
  geminiKey: string,
  openaiKey: string,
  xaiKey: string,
  options?: GenerationOptions,
) => Promise<string>;

export interface AssessmentGenerationInput {
  form: CourseForm;
  indicator: Indicator | null;
  pdfExcerpt?: string;
  model: string;
  geminiKey: string;
  openaiKey: string;
  xaiKey: string;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface AssessmentGenerationResult {
  document: AssessmentDocument;
  markdown: string;
  validation: ValidationResult;
  repairUsed: boolean;
  repairStatus: AssessmentRepairStatus;
  outputChars: number;
}

export type AssessmentRepairStatus = "not_needed" | "succeeded" | "failed";

function stage(
  callback: AssessmentGenerationInput["onProgress"],
  phase: GenerationProgress["phase"],
  receivedChars: number,
  completedSections: GenerationProgress["completedSections"] = [],
): void {
  callback?.({ phase, receivedChars, completedSections });
}

function generationOptions(
  input: AssessmentGenerationInput,
  schema: Record<string, unknown>,
  progressPhase?: GenerationProgress["phase"],
): GenerationOptions {
  return {
    onProgress: input.onProgress,
    progressPhase,
    structured: { name: "npdl_assessment", schema },
    cacheKey: "npdl-assessment-v7-canonical-stems",
  };
}

function repairResolvedAllErrors(
  before: ValidationResult,
  after: ValidationResult,
): boolean {
  const beforeErrors = new Set(before.errors);
  const afterErrors = new Set(after.errors);
  const resolvedOriginalErrors = before.errors.every((error) => !afterErrors.has(error));
  const introducedNoNewErrors = after.errors.every((error) => beforeErrors.has(error));
  return resolvedOriginalErrors && introducedNoNewErrors;
}

async function generateStructuredAssessment(
  input: AssessmentGenerationInput,
  generate: AssessmentGenerateFn,
): Promise<AssessmentGenerationResult> {
  const raw = await generate(
    buildStructuredGeneratePrompt(input.form, input.indicator, input.pdfExcerpt),
    input.model,
    input.geminiKey,
    input.openaiKey,
    input.xaiKey,
    generationOptions(input, ASSESSMENT_DOCUMENT_SCHEMA),
  );
  let outputChars = raw.length;
  let repairUsed = false;
  let repairStatus: AssessmentRepairStatus = "not_needed";
  let document;

  try {
    document = parseAssessmentDocument(raw);
  } catch (primaryError) {
    repairUsed = true;
    stage(input.onProgress, "repairing", outputChars);
    const recovered = await generate(
      buildStructuredRecoveryPrompt(
        raw,
        primaryError instanceof Error ? primaryError.message : String(primaryError),
        input.form,
      ),
      input.model,
      input.geminiKey,
      input.openaiKey,
      input.xaiKey,
      generationOptions(input, ASSESSMENT_DOCUMENT_SCHEMA, "repairing"),
    );
    outputChars += recovered.length;
    try {
      document = parseAssessmentDocument(recovered);
      repairStatus = "succeeded";
    } catch (repairError) {
      throw new Error(
        `結構化評量解析失敗，且唯一一次修復仍未通過。原始錯誤：${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }；修復錯誤：${repairError instanceof Error ? repairError.message : String(repairError)}`,
      );
    }
  }

  document = normalizeAssessmentQuestionStems(document);
  stage(input.onProgress, "rendering", outputChars, ["narrative", "pre", "post"]);
  let markdown = renderAssessmentMarkdown(document, input.form);
  stage(input.onProgress, "validating", outputChars, ["narrative", "pre", "post"]);
  let validation = validateGeneratedMarkdown(markdown, input.form);

  if (!validation.ok && !repairUsed) {
    repairUsed = true;
    repairStatus = "failed";
    const targets = getErrorTargets(validation);
    const patchSchema = buildAssessmentPatchSchema(targets);
    const source = selectAssessmentPatchSource(document, targets);
    const repairContext = selectAssessmentRepairContext(document, targets);
    stage(input.onProgress, "repairing", outputChars);
    const patchRaw = await generate(
      buildStructuredRepairPrompt(
        source,
        validation.errors,
        input.form,
        targets.includes("global"),
        repairContext,
        patchSchema,
      ),
      input.model,
      input.geminiKey,
      input.openaiKey,
      input.xaiKey,
      generationOptions(input, patchSchema, "repairing"),
    );
    outputChars += patchRaw.length;
    try {
      const patch = parseAssessmentPatch(patchRaw, targets);
      const candidateDocument = normalizeAssessmentQuestionStems(
        mergeAssessmentPatch(document, patch, targets),
      );
      stage(input.onProgress, "rendering", outputChars, ["narrative", "pre", "post"]);
      const candidateMarkdown = renderAssessmentMarkdown(candidateDocument, input.form);
      stage(input.onProgress, "validating", outputChars, ["narrative", "pre", "post"]);
      const recheck = validateGeneratedMarkdown(candidateMarkdown, input.form);
      if (repairResolvedAllErrors(validation, recheck)) {
        document = candidateDocument;
        markdown = candidateMarkdown;
        validation = recheck;
        repairStatus = "succeeded";
      }
    } catch {
      // 第二次請求是最後修復額度；解析失敗時保留第一份內容與原始錯誤。
    }
  }

  return { document, markdown, validation, repairUsed, repairStatus, outputChars };
}

export async function generateAssessment(
  input: AssessmentGenerationInput,
  generate: AssessmentGenerateFn = generateContent,
): Promise<AssessmentGenerationResult> {
  stage(input.onProgress, "connecting", 0);
  return generateStructuredAssessment(input, generate);
}
