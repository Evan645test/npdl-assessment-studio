import indicators from "@/data/indicators.json";
import type { Indicator } from "@/types";

export const INDICATORS = indicators as Indicator[];

export function getIndicatorById(id: string): Indicator | undefined {
  return INDICATORS.find((item) => item.id === id);
}

export function getIndicatorsByDimension(dimension: string): Indicator[] {
  return INDICATORS.filter((item) => item.dimension === dimension);
}
