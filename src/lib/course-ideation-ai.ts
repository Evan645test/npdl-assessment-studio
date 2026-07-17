import { MODEL_OPTIONS, type ModelProvider } from "@/data/constants";

export const COURSE_IDEATION_DEFAULT_MODEL = "gemini-2.5-flash";

export const COURSE_IDEATION_MODEL_OPTIONS = MODEL_OPTIONS.filter(
  (option) => option.group !== "free",
);

const courseIdeationModelValues = new Set<string>(
  COURSE_IDEATION_MODEL_OPTIONS.map((option) => option.value),
);

export type CourseIdeationProvider = Exclude<ModelProvider, "free">;

export function isCourseIdeationModel(model: unknown): model is string {
  return typeof model === "string" && courseIdeationModelValues.has(model);
}

export function resolveCourseIdeationModel(
  savedCourseModel: unknown,
  legacySharedModel: unknown,
): string {
  if (isCourseIdeationModel(savedCourseModel)) return savedCourseModel;
  if (isCourseIdeationModel(legacySharedModel)) return legacySharedModel;
  return COURSE_IDEATION_DEFAULT_MODEL;
}

export function getCourseIdeationProvider(model: string): CourseIdeationProvider {
  const provider = COURSE_IDEATION_MODEL_OPTIONS.find(
    (option) => option.value === model,
  )?.group;
  if (provider === "openai" || provider === "xai" || provider === "gemini") {
    return provider;
  }
  return "gemini";
}
