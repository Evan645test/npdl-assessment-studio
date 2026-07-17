import type { AssessmentTarget, RefineTarget } from "@/types";

export function splitModules(markdown: string | null): string[] {
  if (!markdown) return [];
  return markdown
    .split(/(?=^## )/m)
    .filter((part) => part.trim().startsWith("##"));
}

export function applyRefine(
  fullContent: string,
  target: RefineTarget,
  newContent: string,
): string {
  const trimmed = newContent.trim();
  if (target.type === "progression") {
    const re = new RegExp(`(###.*?(?:${target.id}).*?\\n)([\\s\\S]*?)(?=###|$)`, "i");
    return fullContent.replace(re, `$1${trimmed}\n\n`);
  }
  if (target.type === "scenario") {
    const re = new RegExp(
      `(\\*\\*【${target.id}共用情境】\\*\\*\\n)([\\s\\S]*?)(?=> \\*\\*Q|##|$)`,
      "i",
    );
    return fullContent.replace(re, `$1${trimmed}\n\n`);
  }
  if (target.type === "question") {
    const normalizedId = target.id.replace(/\.+$/, "");
    const escapedId = normalizedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(> \\*\\*${escapedId}\\.[\\s\\S]*?)(?=> \\*\\*Q|##|$)`, "i");
    return fullContent.replace(re, `${trimmed}\n\n`);
  }
  return fullContent;
}

export function buildContextSummary(parts: string[]): string {
  return parts.filter(Boolean).join(" · ");
}

function headingForTarget(target: AssessmentTarget): string | null {
  if (target === "narrative") return "## 課程敘述語";
  if (target.startsWith("pre.")) return "## 課前：思維診斷";
  if (target.startsWith("post.")) return "## 課後：轉折遷移";
  return null;
}

function moduleMap(markdown: string): Map<string, string> {
  const modules = new Map<string, string>();
  for (const module of splitModules(markdown)) {
    const heading = module.match(/^## .+$/m)?.[0];
    if (heading) modules.set(heading, module.trim());
  }
  return modules;
}

export function selectMarkdownRepairSource(
  markdown: string,
  targets: AssessmentTarget[],
): string {
  if (targets.includes("global")) return markdown;
  const modules = moduleMap(markdown);
  const headings = new Set(targets.map(headingForTarget).filter((value): value is string => Boolean(value)));
  return [...headings].map((heading) => modules.get(heading)).filter(Boolean).join("\n\n");
}

function targetPattern(target: AssessmentTarget): RegExp | null {
  if (target === "narrative") return /^## 課程敘述語[\s\S]*?(?=^## |$)/m;
  const section = target.startsWith("pre.") ? "課前" : target.startsWith("post.") ? "課後" : null;
  if (!section) return null;
  const field = target.split(".")[1];
  if (field === "scenario") {
    return new RegExp(`\\*\\*【${section}共用情境】\\*\\*[\\s\\S]*?(?=^> \\*\\*Q1\\.)`, "m");
  }
  if (/^q[1-3]$/.test(field)) {
    const question = Number(field.slice(1));
    return new RegExp(`^> \\*\\*Q${question}\\.[\\s\\S]*?(?=^> \\*\\*Q${question + 1}\\.)`, "m");
  }
  if (field === "q4") {
    return /^> \*\*Q4\.[\s\S]*?(?=^\*\*【統計規格與總分落點標準】\*\*)/m;
  }
  if (field === "statistics") {
    return /^\*\*【統計規格與總分落點標準】\*\*[\s\S]*?(?=^## |$)/m;
  }
  return null;
}

export function mergeMarkdownRepair(
  original: string,
  repaired: string,
  targets: AssessmentTarget[],
): string {
  if (targets.includes("global")) return repaired.trim();
  let merged = original;
  for (const target of targets) {
    const pattern = targetPattern(target);
    if (!pattern) continue;
    const replacement = repaired.match(pattern)?.[0]?.trimEnd();
    if (!replacement || !pattern.test(merged)) {
      throw new Error(`局部修復回應缺少必要範圍：${target}`);
    }
    merged = merged.replace(pattern, `${replacement}\n\n`);
  }
  return merged.trim();
}
