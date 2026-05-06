import type { RuntimeProductionBonuses } from "./coreSimulation";
import { getResearchEffects } from "./research";
import type { GameStateSnapshot } from "./types";

export function getEffectiveAxioms(state: Pick<GameStateSnapshot, "resources" | "axiomUpgrades">): number {
  return state.resources.axioms + state.axiomUpgrades.form * 1.5 + state.axiomUpgrades.recursion * 0.8;
}

export function getAxiomSpeedMultiplier(state: Pick<GameStateSnapshot, "axiomUpgrades">): number {
  return 1 + state.axiomUpgrades.growth * 0.08;
}

export function getRuntimeProductionBonuses(
  state: Pick<GameStateSnapshot, "researchPurchasedIds" | "axiomUpgrades" | "strainMastery">,
): RuntimeProductionBonuses {
  const researchEffects = getResearchEffects(state.researchPurchasedIds);
  return {
    growthMultiplier: researchEffects.growthMultiplier,
    extractionMultiplier: researchEffects.extractionMultiplier,
    patternMultiplier: researchEffects.patternMultiplier,
    instabilityBonus: researchEffects.instabilityBonus + state.axiomUpgrades.containment * 0.08,
    strainMastery: state.strainMastery,
  };
}
