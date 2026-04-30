import { getNodeCost } from "./balancing";
import { formulas } from "./formulas";
import { calculateCollapseRequirement, calculateStableMutationsGain, calculateProduction } from "./simulation";
import type { GameStateSnapshot } from "./types";

export function formatNumber(value: number): string {
  if (value < 1000) return value.toFixed(value < 100 ? 1 : 0);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return value.toExponential(2);
}

export function isFormulaVisible(state: GameStateSnapshot, formulaId: string): boolean {
  const formula = formulas.find((item) => item.id === formulaId);
  if (!formula) return false;
  const requires = formula.unlockRequires;
  if (!requires) return true;
  return (
    (requires.nodes ?? 0) <= state.nodes ||
    (requires.essenceEarned ?? 0) <= state.totalEssenceEarned ||
    (requires.patternsEarned ?? 0) <= state.totalPatternsEarned ||
    (requires.axioms ?? 0) <= state.resources.axioms
  );
}

export function canUnlockFormula(state: GameStateSnapshot, formulaId: string): boolean {
  const formula = formulas.find((item) => item.id === formulaId);
  if (!formula || state.unlockedFormulaIds.includes(formulaId)) return false;
  const requires = formula.unlockRequires;
  const requirementMet = !requires || (
    (requires.nodes === undefined || state.nodes >= requires.nodes) &&
    (requires.essenceEarned === undefined || state.totalEssenceEarned >= requires.essenceEarned) &&
    (requires.patternsEarned === undefined || state.totalPatternsEarned >= requires.patternsEarned) &&
    (requires.axioms === undefined || state.resources.axioms >= requires.axioms)
  );
  return requirementMet && state.resources.essence >= formula.unlockCost;
}

export function getDerivedState(state: GameStateSnapshot) {
  return {
    nodeCost: getNodeCost(state.nodes),
    production: calculateProduction(state),
    collapseRequirement: calculateCollapseRequirement(state),
    collapseReward: calculateStableMutationsGain(state),
  };
}
