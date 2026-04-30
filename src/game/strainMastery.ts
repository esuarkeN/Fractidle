import { CORE_DEFINITIONS } from "./coreDefinitions";
import type { CoreDefinitionId } from "./coreTypes";
import type { StrainMastery } from "./types";

export function createInitialStrainMastery(): Record<string, StrainMastery> {
  return Object.keys(CORE_DEFINITIONS).reduce<Record<string, StrainMastery>>((record, definitionId) => {
    record[definitionId] = { harvests: 0, lifetimeEssence: 0, highestComplexity: 0, peakOwned: 0 };
    return record;
  }, {});
}

export function normalizeStrainMastery(saved: Record<string, Partial<StrainMastery>> | undefined): Record<string, StrainMastery> {
  const initial = createInitialStrainMastery();
  for (const definitionId of Object.keys(initial)) {
    const mastery = saved?.[definitionId];
    if (!mastery) continue;
    initial[definitionId] = {
      harvests: Math.max(0, mastery.harvests ?? 0),
      lifetimeEssence: Math.max(0, mastery.lifetimeEssence ?? 0),
      highestComplexity: Math.max(0, mastery.highestComplexity ?? 0),
      peakOwned: Math.max(0, mastery.peakOwned ?? 0),
    };
  }
  return initial;
}

export function getStrainMasteryLevel(mastery: StrainMastery | undefined): number {
  if (!mastery) return 0;
  const score =
    mastery.harvests +
    Math.sqrt(mastery.lifetimeEssence) * 0.22 +
    mastery.highestComplexity * 0.65 +
    mastery.peakOwned * 4;
  if (score >= 520) return 5;
  if (score >= 260) return 4;
  if (score >= 120) return 3;
  if (score >= 42) return 2;
  if (score >= 12) return 1;
  return 0;
}

export function getMasteryBonus(definitionId: CoreDefinitionId, masteryRecord: Record<string, StrainMastery>) {
  const level = getStrainMasteryLevel(masteryRecord[definitionId]);
  return {
    level,
    growthMultiplier: level * 0.035,
    extractionMultiplier: level * 0.055,
    patternMultiplier: CORE_DEFINITIONS[definitionId].fractalType === "echo" ? level * 0.04 : 0,
    instabilityMultiplier: CORE_DEFINITIONS[definitionId].fractalType === "lightning" || CORE_DEFINITIONS[definitionId].fractalType === "mutation" ? level * 0.04 : 0,
  };
}

export function getTotalMasteryLevel(masteryRecord: Record<string, StrainMastery>): number {
  return Object.values(CORE_DEFINITIONS).reduce((total, definition) => total + getMasteryBonus(definition.id, masteryRecord).level, 0);
}
