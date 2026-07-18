import entriesJson from "@/data/curriculum/entries.json";
import manifestJson from "@/data/curriculum/manifest.json";
import type {
  CurriculumCandidateSet,
  CurriculumEntry,
  CurriculumKind,
  CurriculumStage,
  CourseIdeationInput,
  KeywordAnalysisResult,
} from "@/types/course-ideation";

export const CURRICULUM_NOTEBOOK_URL = manifestJson.notebookUrl;
export const CURRICULUM_SNAPSHOT_VERSION = manifestJson.snapshotVersion;
export const CURRICULUM_SOURCES = manifestJson.sources;
export const CURRICULUM_ENTRIES = entriesJson as CurriculumEntry[];

const SCIENCE_SUBJECTS = new Set(["化學", "生物", "物理", "地科", "地球科學"]);
const SOCIAL_SUBJECTS = new Set(["社會", "地理", "歷史", "公民", "公民與社會"]);

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s，。、；：！？「」『』（）()\-_*◎]/g, "");
}

function bigrams(value: string): Set<string> {
  const normalized = normalize(value);
  const output = new Set<string>();
  if (normalized.length <= 1) {
    if (normalized) output.add(normalized);
    return output;
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    output.add(normalized.slice(index, index + 2));
  }
  return output;
}

function stageFromGrade(grade: string): CurriculumStage {
  return grade.startsWith("國") ? "IV" : "V";
}

function subjectMatches(inputSubject: string, entry: CurriculumEntry): boolean {
  const subject = inputSubject.trim();
  if (SCIENCE_SUBJECTS.has(subject)) {
    return (
      entry.subject === "自然科學" ||
      entry.subject === subject ||
      (subject === "地科" && entry.subject === "地球科學")
    );
  }
  if (subject === "國文") return entry.subject === "國語文";
  if (subject === "英文") return entry.subject === "英語文";
  if (subject === "公民") return entry.subject === "公民與社會";
  if (subject === "社會") {
    return (
      entry.subject === "歷史" ||
      entry.subject === "地理" ||
      entry.subject === "公民與社會"
    );
  }
  if (SOCIAL_SUBJECTS.has(subject)) return entry.subject === subject;
  return entry.subject === subject;
}

function relevanceScore(entry: CurriculumEntry, query: string): number {
  const normalizedQuery = normalize(query);
  const normalizedEntry = normalize(`${entry.code}${entry.text}`);
  let score = 0;
  if (normalizedQuery.includes(normalize(entry.code))) score += 100;
  for (const rawToken of query.split(/[,，、;；：:\n\s]+/).filter(Boolean)) {
    const token = normalize(rawToken);
    if (token.length >= 2 && normalizedEntry.includes(token)) score += token.length * 4;
  }
  const queryBigrams = bigrams(normalizedQuery);
  const entryBigrams = bigrams(normalizedEntry);
  for (const pair of queryBigrams) {
    if (entryBigrams.has(pair)) score += 1;
  }
  if (entry.courseType === "required") score += 2;
  if (entry.courseType === "all") score += 1;
  return score;
}

function sortedCandidates(
  kind: CurriculumKind,
  input: CourseIdeationInput,
  analysis?: KeywordAnalysisResult | null,
  additionalEntries: CurriculumEntry[] = [],
): CurriculumEntry[] {
  const stage = stageFromGrade(input.grade);
  const query = [
    input.subject,
    input.unitName,
    input.teachingTopic,
    ...input.coreKeywords,
    analysis?.summary ?? "",
    ...(analysis?.themes.flatMap((theme) => [
      theme.label,
      ...theme.keywords,
      theme.interpretation,
    ]) ?? []),
  ].join(" ");
  return [...CURRICULUM_ENTRIES, ...additionalEntries]
    .filter(
      (entry) =>
        entry.kind === kind &&
        entry.stage === stage &&
        subjectMatches(input.subject, entry),
    )
    .map((entry, index) => ({
      entry,
      index,
      score: relevanceScore(entry, query),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ entry }) => entry);
}

export function getCurriculumCandidates(
  input: CourseIdeationInput,
  analysis?: KeywordAnalysisResult | null,
  additionalEntries: CurriculumEntry[] = [],
): CurriculumCandidateSet {
  return {
    performances: sortedCandidates(
      "learning_performance",
      input,
      analysis,
      additionalEntries,
    ).slice(0, 10),
    contents: sortedCandidates(
      "learning_content",
      input,
      analysis,
      additionalEntries,
    ).slice(0, 12),
  };
}

export function getCurriculumEntry(
  id: string,
  additionalEntries: CurriculumEntry[] = [],
): CurriculumEntry | null {
  return (
    additionalEntries.find((entry) => entry.id === id) ??
    CURRICULUM_ENTRIES.find((entry) => entry.id === id) ??
    null
  );
}

export function createCustomCurriculumEntry(
  kind: CurriculumKind,
  text: string,
  input: CourseIdeationInput,
  id: string,
): CurriculumEntry {
  const normalizedText = text.trim();
  if (normalizedText.length < 4) {
    throw new Error("教師自訂課綱內容至少需要 4 個字。");
  }
  return {
    id,
    domain: "教師自訂",
    subject: input.subject.trim(),
    stage: stageFromGrade(input.grade),
    kind,
    code: "教師自訂",
    text: normalizedText,
    courseType: "all",
    sourceName: "教師提供、未由系統核對",
    sourceDocumentTitle: "教師自訂課綱依據",
    sourceVersion: "unverified",
  };
}
