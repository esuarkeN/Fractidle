import { getVisualInfluence } from "./visualInfluences";
export function getCoreFormulaInfluence(equippedFormulaIds: Array<string | null>) {
  const visual = getVisualInfluence(equippedFormulaIds);
  const ids = new Set(equippedFormulaIds.filter((id): id is string => Boolean(id)));
  const equippedCount = equippedFormulaIds.filter(Boolean).length;
  const has = (id: string) => ids.has(id);
  return {
    buildSpeedMultiplier: 1 + visual.spiralPower * 0.16 + visual.branchPower * 0.08 + (has("spiral-acceleration") ? 0.18 : 0) + (has("storm-conduction") ? 0.1 : 0),
    branchPower: visual.branchPower,
    symmetryPower: visual.symmetryPower,
    spiralPower: visual.spiralPower,
    patternPower: visual.patternPower,
    branchBurstBonus: visual.branchPower,
    harvestMultiplier: 1 + visual.patternPower * 0.12 + visual.symmetryPower * 0.1 + (has("pattern-archive") ? 0.12 : 0) + (has("fern-replication") ? 0.1 : 0),
    crystalMirrorBonus: visual.symmetryPower,
    recursiveMiniBranches: visual.recursivePower + (has("recursive-seed") ? 1 : 0) + (has("deep-recursion") ? 1 : 0),
    mutationPower: visual.mutationPower,
    stabilityPower: visual.stabilityPower,
    parallelBloomBonus: has("parallel-bloom") ? 0.08 + equippedCount * 0.015 : 0,
  };
}
