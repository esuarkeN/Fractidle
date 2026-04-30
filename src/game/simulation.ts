import { BASE_NODE_PRODUCTION, COLLAPSE_THRESHOLD, softCap } from "./balancing";
import { getTotalEssencePerSecond } from "./coreSimulation";
import { getFormula } from "./formulas";
import { getGeneSynergyBonuses } from "./geneSynergies";
import { getResearchEffects } from "./research";
import { getTotalMasteryLevel } from "./strainMastery";
import type { Formula, GameStateSnapshot, ProductionBreakdown } from "./types";

function equippedFormulas(state: Pick<GameStateSnapshot, "equippedFormulaIds">): Formula[] {
  return state.equippedFormulaIds
    .map((id) => (id ? getFormula(id) : undefined))
    .filter((formula): formula is Formula => Boolean(formula));
}

function formulaWeight(formula: Formula, state: GameStateSnapshot): number {
  const effect = formula.effect;
  let weight = 1;
  if (effect.essenceMultiplier) weight *= effect.essenceMultiplier;
  if (effect.nodeProductionBonus) weight *= 1 + effect.nodeProductionBonus;
  if (effect.perTenNodesMultiplier) weight *= 1 + Math.floor(state.nodes / 10) * effect.perTenNodesMultiplier;
  if (effect.nodeMilestoneEvery && effect.nodeMilestoneMultiplier) {
    weight *= 1 + Math.floor(state.nodes / effect.nodeMilestoneEvery) * effect.nodeMilestoneMultiplier;
  }
  if (effect.patternEssenceMultiplier) {
    weight *= 1 + Math.min(effect.patternEssenceCap ?? 1, state.resources.patterns * effect.patternEssenceMultiplier);
  }
  if (effect.symmetryMultiplier) weight *= 1 + (state.nodes % 2 === 0 ? effect.symmetryMultiplier : effect.symmetryMultiplier * 0.45);
  if (effect.spiralPerMinuteMultiplier) weight *= 1 + (state.totalRuntimeSeconds / 60) * effect.spiralPerMinuteMultiplier;
  if (effect.nestedPerFormulaMultiplier) weight *= 1 + state.unlockedFormulaIds.length * effect.nestedPerFormulaMultiplier;
  return weight;
}

export function calculateProduction(state: GameStateSnapshot): ProductionBreakdown {
  if (state.coreInstances?.length) {
    const effectiveAxioms = state.resources.axioms + state.axiomUpgrades.form * 1.5 + state.axiomUpgrades.recursion * 0.8;
    const researchEffects = getResearchEffects(state.researchPurchasedIds);
    const axiomSpeedMultiplier = 1 + state.axiomUpgrades.growth * 0.08;
    const essencePerSecond = getTotalEssencePerSecond(state.coreInstances, state.coreUpgrades, state.equippedFormulaIds, effectiveAxioms, axiomSpeedMultiplier, {
      growthMultiplier: researchEffects.growthMultiplier,
      extractionMultiplier: researchEffects.extractionMultiplier,
      patternMultiplier: researchEffects.patternMultiplier,
      instabilityBonus: researchEffects.instabilityBonus + state.axiomUpgrades.containment * 0.08,
      strainMastery: state.strainMastery,
    });
    const active = equippedFormulas(state);
    const synergy = getGeneSynergyBonuses(state.equippedFormulaIds);
    const patternsPerSecond = active.reduce((total, formula) => total + ((formula.effect.patternPerSecond ?? 0) * Math.max(1, Math.sqrt(state.nodes)) * 0.25), 0)
      * (1 + state.axiomUpgrades.patterns * 0.12 + researchEffects.patternMultiplier + synergy.patternMultiplier);
    return {
      essencePerSecond,
      patternsPerSecond,
      baseEssence: state.nodes,
      multiplier: 1 + state.resources.axioms * 0.12,
      flatBonus: 0,
    };
  }

  const active = equippedFormulas(state);
  const activeTags = new Set(active.map((formula) => formula.tag));
  let nodeOutput = BASE_NODE_PRODUCTION;
  let multiplier = 1 + state.resources.axioms * 0.12;
  let flatBonus = 0;
  let patternsPerSecond = 0;
  const hasPatternUnlock = active.some((formula) => formula.effect.patternUnlock);

  for (const formula of active) {
    const effect = formula.effect;
    if (effect.nodeProductionBonus) nodeOutput *= 1 + effect.nodeProductionBonus;
    if (effect.essenceMultiplier) multiplier *= effect.essenceMultiplier;
    if (effect.perTenNodesMultiplier) multiplier *= 1 + Math.floor(state.nodes / 10) * effect.perTenNodesMultiplier;
    if (effect.nodeMilestoneEvery && effect.nodeMilestoneMultiplier) {
      multiplier *= 1 + Math.floor(state.nodes / effect.nodeMilestoneEvery) * effect.nodeMilestoneMultiplier;
    }
    if (effect.patternEssenceMultiplier) {
      multiplier *= 1 + Math.min(effect.patternEssenceCap ?? 1, state.resources.patterns * effect.patternEssenceMultiplier);
    }
    if (effect.synergyTags?.some((tag) => activeTags.has(tag))) {
      multiplier *= 1 + (effect.synergyMultiplier ?? 0);
    }
    if (effect.diversityMultiplier) {
      multiplier *= 1 + new Set(active.map((item) => item.tag)).size * effect.diversityMultiplier;
    }
    if (effect.symmetryMultiplier) multiplier *= 1 + (state.nodes % 2 === 0 ? effect.symmetryMultiplier : effect.symmetryMultiplier * 0.45);
    if (effect.spiralPerMinuteMultiplier) multiplier *= 1 + (state.totalRuntimeSeconds / 60) * effect.spiralPerMinuteMultiplier;
    if (effect.nestedPerFormulaMultiplier) multiplier *= 1 + state.unlockedFormulaIds.length * effect.nestedPerFormulaMultiplier;
    if (effect.firstNodeFlatBonus && state.nodes >= 1) flatBonus += effect.firstNodeFlatBonus;
    if (effect.axiomFlatBonus) flatBonus += state.resources.axioms * effect.axiomFlatBonus;
    if (effect.essenceFlatBonus) flatBonus += effect.essenceFlatBonus;
    if (effect.patternPerSecond && (hasPatternUnlock || formula.tag === "pattern")) {
      patternsPerSecond += effect.patternPerSecond * Math.max(1, Math.sqrt(state.nodes));
    }
  }

  const weights = active.map((formula) => formulaWeight(formula, state));
  const mirror = active.find((formula) => formula.effect.mirrorStrength);
  if (mirror && weights.length >= 2) {
    const strongest = Math.max(...weights);
    const weakest = Math.min(...weights);
    const reflectedPower = Math.max(0, strongest - weakest) * (mirror.effect.mirrorStrength ?? 0);
    multiplier *= 1 + reflectedPower;
  }

  const baseEssence = state.nodes * nodeOutput;
  return {
    essencePerSecond: (baseEssence + flatBonus) * multiplier,
    patternsPerSecond,
    baseEssence,
    multiplier,
    flatBonus,
  };
}

export function simulate(state: GameStateSnapshot, deltaSeconds: number): GameStateSnapshot {
  if (deltaSeconds <= 0) return state;
  const production = calculateProduction(state);
  const patternGain = production.patternsPerSecond * deltaSeconds;

  return {
    ...state,
    resources: {
      ...state.resources,
      patterns: state.resources.patterns + patternGain,
    },
    totalPatternsEarned: state.totalPatternsEarned + patternGain,
    totalRuntimeSeconds: state.totalRuntimeSeconds + deltaSeconds,
  };
}

export function calculateCollapseReward(state: GameStateSnapshot): number {
  const requirement = calculateCollapseRequirement(state);
  if (state.currentRunLifetimeEssence < requirement) return 0;
  const active = equippedFormulas(state);
  const rewardMultiplier = active.reduce((total, formula) => {
    const effect = formula.effect;
    const patternReward = effect.patternCollapseRewardMultiplier
      ? Math.min(effect.patternCollapseRewardCap ?? 1, state.resources.patterns * effect.patternCollapseRewardMultiplier)
      : 0;
    return total + (effect.collapseRewardMultiplier ?? 0) + patternReward;
  }, 1);
  const researchEffects = getResearchEffects(state.researchPurchasedIds);
  const masteryMultiplier = 1 + getTotalMasteryLevel(state.strainMastery) * 0.025;
  const depthMultiplier =
    (1 + state.unlockedLayerIds.length * 0.025)
    * (1 + state.unlockedFormulaIds.length * 0.01)
    * (1 + Math.sqrt(Math.max(0, state.highestEssencePerSecond)) * 0.002)
    * (1 + state.mutationEvents.length * 0.01)
    * masteryMultiplier
    * (1 + researchEffects.collapseRewardMultiplier);
  const rawReward = Math.sqrt(state.currentRunLifetimeEssence / requirement) * rewardMultiplier * depthMultiplier;
  return Math.max(1, Math.floor(rawReward));
}

export function calculateCollapseRequirement(state: GameStateSnapshot): number {
  const collapseCount = Math.max(0, state.lifetimeCollapseCount ?? 0);
  const totalMutations = Math.max(0, state.totalStableMutationsEarned ?? state.resources.axioms ?? 0);
  const archiveRelief = state.axiomUpgrades.genomeArchive * 0.015;
  const researchRelief = state.researchPurchasedIds.includes("stable-mutation-theory") ? 0.06 : 0;
  const relief = Math.max(0.72, 1 - Math.min(0.2, archiveRelief + researchRelief));
  return Math.floor(COLLAPSE_THRESHOLD * Math.pow(7.5, collapseCount) * Math.pow(1.12, totalMutations) * relief);
}

export function calculateStableMutationsGain(state: GameStateSnapshot): number {
  const requirement = calculateCollapseRequirement(state);
  if (state.currentRunLifetimeEssence < requirement) return 0;
  const researchEffects = getResearchEffects(state.researchPurchasedIds);
  const depthBonus =
    1
    + Math.min(0.32, state.unlockedLayerIds.length * 0.025)
    + Math.min(0.3, state.unlockedFormulaIds.length * 0.01)
    + Math.min(0.28, Math.sqrt(Math.max(0, state.currentRunHighestExtractionPerSecond)) * 0.002)
    + Math.min(0.25, state.currentRunHighestComplexity * 0.006)
    + Math.min(0.25, getTotalMasteryLevel(state.strainMastery) * 0.015)
    + Math.min(0.18, state.mutationEvents.length * 0.012);
  const formulaBonus = equippedFormulas(state).reduce((total, formula) => {
    const patternReward = formula.effect.patternCollapseRewardMultiplier
      ? Math.min(formula.effect.patternCollapseRewardCap ?? 0.2, state.resources.patterns * formula.effect.patternCollapseRewardMultiplier)
      : 0;
    return total + (formula.effect.collapseRewardMultiplier ?? 0) + patternReward;
  }, 0);
  const mutationGainBonus = state.axiomUpgrades.recursion * 0.035 + researchEffects.collapseRewardMultiplier + formulaBonus;
  const raw = Math.sqrt(state.currentRunLifetimeEssence / requirement) * depthBonus * (1 + softCap(mutationGainBonus, 0.85, 0.55));
  return Math.max(1, Math.floor(raw));
}
