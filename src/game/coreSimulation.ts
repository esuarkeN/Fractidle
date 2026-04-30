import {
  createInitialCoreInstances,
  createInitialCoreUpgrades,
  getCoreComplexity,
  getCoreOutputTierMultiplier,
  getCoreSpeedMultiplier,
  getCoreYieldMultiplier,
} from "./coreBalancing";
import { softCap } from "./balancing";
import { CORE_DEFINITIONS } from "./coreDefinitions";
import type { CoreDefinitionId, CoreHarvest, CoreInstance, CoreLayerId, CoreTypeUpgrade } from "./coreTypes";
import { getCoreFormulaInfluence } from "./formulaInfluences";
import { getGeneSynergyBonuses } from "./geneSynergies";
import { getMasteryBonus } from "./strainMastery";
import type { StrainMastery } from "./types";

export type RuntimeProductionBonuses = {
  growthMultiplier?: number;
  extractionMultiplier?: number;
  patternMultiplier?: number;
  instabilityBonus?: number;
  strainMastery?: Record<string, StrainMastery>;
};

export type CoreTickResult = {
  instances: CoreInstance[];
  essenceGained: number;
  patternsGained: number;
  harvests: CoreHarvest[];
};

type TickContext = {
  upgrades: CoreTypeUpgrade[];
  equippedFormulaIds: Array<string | null>;
  axioms: number;
  deltaSeconds: number;
  axiomSpeedMultiplier: number;
  runtimeBonuses: RuntimeProductionBonuses;
  ownedCoreCount: number;
};

export function normalizeCoreInstances(instances: CoreInstance[] | undefined): CoreInstance[] {
  if (!instances?.length) return createInitialCoreInstances();
  const normalized = instances
    .filter((instance) => Boolean(CORE_DEFINITIONS[instance.definitionId]))
    .map((instance, index) => ({
      ...instance,
      instanceIndex: instance.instanceIndex ?? index + 1,
      level: instance.level ?? 1,
      complexity: instance.complexity ?? CORE_DEFINITIONS[instance.definitionId]?.baseComplexity ?? 8,
      buildSpeedMultiplier: instance.buildSpeedMultiplier ?? 1,
      yieldMultiplier: instance.yieldMultiplier ?? 1,
      cycleProgress: instance.cycleProgress ?? 0,
      currentBuiltBranches: instance.currentBuiltBranches ?? 0,
      currentSeed: instance.currentSeed ?? (Date.now() + index * 7919),
      currentState: instance.currentState ?? "building",
      stateProgress: instance.stateProgress ?? 0,
      createdAt: instance.createdAt ?? Date.now(),
    }));
  return normalized.length ? normalized : createInitialCoreInstances();
}

export function normalizeCoreUpgrades(upgrades: CoreTypeUpgrade[] | undefined): CoreTypeUpgrade[] {
  const initial = createInitialCoreUpgrades();
  return initial.map((base) => {
    const saved = upgrades?.find((upgrade) => upgrade.definitionId === base.definitionId);
    return saved ? { ...base, ...saved, speedLevel: saved.speedLevel ?? 0 } : base;
  });
}

export function isCoreDefinitionAvailable(
  definitionId: CoreDefinitionId,
  essence: number,
  patterns: number,
  ownedCores: number,
  unlockedLayers = 1,
  axioms = 0,
): boolean {
  const requirement = CORE_DEFINITIONS[definitionId].unlockRequirement;
  if (!requirement) return true;
  return (
    (requirement.essence === undefined || essence >= requirement.essence) &&
    (requirement.patterns === undefined || patterns >= requirement.patterns) &&
    (requirement.ownedCores === undefined || ownedCores >= requirement.ownedCores) &&
    (requirement.unlockedLayers === undefined || unlockedLayers >= requirement.unlockedLayers) &&
    (requirement.axioms === undefined || axioms >= requirement.axioms)
  );
}

export function getUnlockedLayerIds(instances: CoreInstance[], essence: number, patterns: number, axioms = 0): Exclude<CoreLayerId, "all">[] {
  const ownedDefinitions = new Set(instances.map((instance) => instance.definitionId));
  const unlocked = new Set<Exclude<CoreLayerId, "all">>(["root-grove"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of Object.values(CORE_DEFINITIONS)) {
      if (!ownedDefinitions.has(definition.id) && !isCoreDefinitionAvailable(definition.id, essence, patterns, instances.length, unlocked.size, axioms)) continue;
      const before = unlocked.size;
      unlocked.add(definition.layerId);
      changed = changed || unlocked.size > before;
    }
  }
  return [...unlocked];
}

export function getCoreBuildSpeed(instance: CoreInstance, upgrades: CoreTypeUpgrade[], equippedFormulaIds: Array<string | null>, ownedCoreCount = 1, axiomSpeedMultiplier = 1, runtimeBonuses: RuntimeProductionBonuses = {}): number {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const influence = getCoreFormulaInfluence(equippedFormulaIds);
  const synergies = getGeneSynergyBonuses(equippedFormulaIds);
  const mastery = runtimeBonuses.strainMastery ? getMasteryBonus(instance.definitionId, runtimeBonuses.strainMastery) : undefined;
  const typeBonus =
    definition.fractalType === "spiral" ? 1 + influence.spiralPower * 0.18 :
    definition.fractalType === "root" ? 1 + influence.branchPower * 0.1 :
    definition.fractalType === "lightning" ? 1.28 + influence.mutationPower * 0.09 :
    definition.fractalType === "fern" ? 1 + Math.min(0.45, ownedCoreCount * 0.018) :
    definition.fractalType === "cell" ? 1.08 + influence.stabilityPower * 0.04 :
    definition.fractalType === "mycelium" ? 1 + Math.min(0.35, ownedCoreCount * 0.02) :
    definition.fractalType === "mutation" ? 0.9 + (runtimeBonuses.instabilityBonus ?? 0) * 0.2 :
    1;
  const chamberGrowthBonus =
    definition.layerId === "root-grove" && (definition.fractalType === "root" || definition.fractalType === "cell" || definition.fractalType === "mycelium") ? 0.08 :
    definition.layerId === "spiralarium" ? 0.16 :
    definition.layerId === "storm-plane" ? 0.22 :
    definition.layerId === "inner-worlds" ? 0.06 + axiomaticRuntimeDepth(runtimeBonuses) :
    0;
  const formulaGrowthBucket = 1 + softCap(influence.buildSpeedMultiplier - 1 + influence.parallelBloomBonus, 1.4, 0.55);
  const chamberBucket = 1 + softCap(chamberGrowthBonus, 0.7, 0.55);
  const researchBucket = 1 + softCap(runtimeBonuses.growthMultiplier ?? 0, 0.8, 0.55);
  const synergyBucket = 1 + softCap(synergies.growthMultiplier + (mastery?.growthMultiplier ?? 0), 0.75, 0.55);
  const prestigeBucket = 1 + softCap(axiomSpeedMultiplier - 1, 0.9, 0.55);
  return definition.baseBuildSpeed
    * getCoreSpeedMultiplier(instance, upgrades)
    * typeBonus
    * formulaGrowthBucket
    * chamberBucket
    * researchBucket
    * synergyBucket
    * prestigeBucket;
}

export function getCoreHarvestValue(
  instance: CoreInstance,
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
  axioms: number,
  runtimeBonuses: RuntimeProductionBonuses = {},
): { essence: number; patterns: number } {
  const definition = CORE_DEFINITIONS[instance.definitionId];
  const influence = getCoreFormulaInfluence(equippedFormulaIds);
  const synergies = getGeneSynergyBonuses(equippedFormulaIds);
  const mastery = runtimeBonuses.strainMastery ? getMasteryBonus(instance.definitionId, runtimeBonuses.strainMastery) : undefined;
  const complexity = getCoreComplexity(instance, upgrades);
  const typeBonus =
    definition.fractalType === "crystal" ? 1.25 + influence.symmetryPower * 0.12 :
    definition.fractalType === "echo" ? 0.92 + influence.patternPower * 0.16 :
    definition.fractalType === "fern" ? 1 + Math.min(1.2, complexity * 0.012) :
    definition.fractalType === "lightning" ? 0.72 + influence.mutationPower * 0.08 :
    definition.fractalType === "recursive" ? 1.8 + axioms * 0.18 + influence.recursiveMiniBranches * 0.12 :
    definition.fractalType === "cell" ? 0.95 + Math.min(0.65, complexity * 0.01) :
    definition.fractalType === "mycelium" ? 1.05 + influence.branchPower * 0.08 :
    definition.fractalType === "mutation" ? 1.4 + (runtimeBonuses.instabilityBonus ?? 0) * 0.35 :
    definition.fractalType === "boundary" ? 2.2 + axioms * 0.24 + statefulFormulaDepth(equippedFormulaIds) :
    1;
  const baseHarvest = complexity * definition.baseYieldPerNode * getCoreOutputTierMultiplier(definition.outputTier) * getCoreYieldMultiplier(instance, upgrades);
  const formulaBucket = 1 + softCap(influence.harvestMultiplier - 1, 1.6, 0.55);
  const typeBucket = 1 + softCap(typeBonus - 1, 2.8, 0.55);
  const prestigeBucket = 1 + softCap(axioms * 0.08, 1.8, 0.55);
  const chamberBucket = 1 + softCap(getChamberExtractionBonus(definition.layerId, equippedFormulaIds), 0.9, 0.55);
  const researchBucket = 1 + softCap(runtimeBonuses.extractionMultiplier ?? 0, 1, 0.55);
  const synergyBucket = 1 + softCap(synergies.extractionMultiplier + (mastery?.extractionMultiplier ?? 0), 1, 0.55);
  const essence = baseHarvest * formulaBucket * typeBucket * prestigeBucket * chamberBucket * researchBucket * synergyBucket;
  const patterns =
    definition.fractalType === "echo" ? Math.max(0.15, complexity * 0.045 * (1 + influence.patternPower * 0.25)) :
    definition.fractalType === "recursive" ? Math.max(0.05, complexity * 0.012 * (1 + axioms * 0.04)) :
    definition.fractalType === "mycelium" ? Math.max(0.03, complexity * 0.01) :
    definition.fractalType === "mutation" ? Math.max(0.08, complexity * 0.014 * (1 + (runtimeBonuses.instabilityBonus ?? 0))) :
    definition.fractalType === "boundary" ? Math.max(0.18, complexity * 0.03) :
    0;
  const patternBucket = 1 + softCap((runtimeBonuses.patternMultiplier ?? 0) + synergies.patternMultiplier + (mastery?.patternMultiplier ?? 0), 1.2, 0.55);
  return { essence, patterns: patterns * patternBucket };
}

function getChamberExtractionBonus(layerId: CoreLayerId, equippedFormulaIds: Array<string | null>): number {
  const activeTags = new Set(equippedFormulaIds.filter(Boolean));
  if (layerId === "crystal-lattice") return 0.18;
  if (layerId === "echo-field") return 0.06;
  if (layerId === "verdant-plane") return 0.1;
  if (layerId === "entropy-rift") return 0.28;
  if (layerId === "infinite-boundary") return 0.45;
  if (layerId === "inner-worlds") return 0.16 + activeTags.size * 0.01;
  return 0;
}

function axiomaticRuntimeDepth(runtimeBonuses: RuntimeProductionBonuses): number {
  return Math.min(0.16, (runtimeBonuses.extractionMultiplier ?? 0) * 0.1);
}

function statefulFormulaDepth(equippedFormulaIds: Array<string | null>): number {
  return equippedFormulaIds.filter(Boolean).length * 0.08;
}

export function getTotalEssencePerSecond(
  instances: CoreInstance[],
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
  axioms: number,
  axiomSpeedMultiplier = 1,
  runtimeBonuses: RuntimeProductionBonuses = {},
): number {
  return instances.reduce((total, instance) => {
    const complexity = getCoreComplexity(instance, upgrades);
    const speed = getCoreBuildSpeed(instance, upgrades, equippedFormulaIds, instances.length, axiomSpeedMultiplier, runtimeBonuses);
    const harvest = getCoreHarvestValue(instance, upgrades, equippedFormulaIds, axioms, runtimeBonuses).essence;
    const cycleTime = Math.max(0.8, complexity / Math.max(0.1, speed) + 0.9);
    return total + harvest / cycleTime;
  }, 0);
}

export function tickCoreInstances(
  instances: CoreInstance[],
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
  axioms: number,
  deltaSeconds: number,
  axiomSpeedMultiplier = 1,
  runtimeBonuses: RuntimeProductionBonuses = {},
): CoreTickResult {
  let essenceGained = 0;
  let patternsGained = 0;
  const harvests: CoreHarvest[] = [];

  const context: TickContext = { upgrades, equippedFormulaIds, axioms, deltaSeconds, axiomSpeedMultiplier, runtimeBonuses, ownedCoreCount: instances.length };
  const nextInstances = instances.map((instance) => {
    const result = tickVisibleCoreInstance(instance, context);
    essenceGained += result.essenceGained;
    patternsGained += result.patternsGained;
    harvests.push(...result.harvests);
    return result.instance;
  });

  return { instances: nextInstances, essenceGained, patternsGained, harvests };
}

export function tickCoreInstancesForSelectedChamber(
  instances: CoreInstance[],
  upgrades: CoreTypeUpgrade[],
  equippedFormulaIds: Array<string | null>,
  axioms: number,
  deltaSeconds: number,
  selectedLayerId: CoreLayerId,
  axiomSpeedMultiplier = 1,
  runtimeBonuses: RuntimeProductionBonuses = {},
): CoreTickResult {
  let essenceGained = 0;
  let patternsGained = 0;
  const harvests: CoreHarvest[] = [];
  const context: TickContext = { upgrades, equippedFormulaIds, axioms, deltaSeconds, axiomSpeedMultiplier, runtimeBonuses, ownedCoreCount: instances.length };
  const nextInstances = instances.map((instance) => {
    const isVisible = selectedLayerId !== "all" && CORE_DEFINITIONS[instance.definitionId].layerId === selectedLayerId;
    const result = isVisible ? tickVisibleCoreInstance(instance, context) : tickHiddenCoreInstance(instance, context);
    essenceGained += result.essenceGained;
    patternsGained += result.patternsGained;
    harvests.push(...result.harvests);
    return result.instance;
  });

  return { instances: nextInstances, essenceGained, patternsGained, harvests };
}

function tickVisibleCoreInstance(instance: CoreInstance, context: TickContext): CoreTickResult & { instance: CoreInstance } {
  const { upgrades, equippedFormulaIds, axioms, deltaSeconds, axiomSpeedMultiplier, runtimeBonuses, ownedCoreCount } = context;
  const complexity = getCoreComplexity(instance, upgrades);
  if (instance.currentState === "harvesting") {
    const stateProgress = instance.stateProgress + deltaSeconds * 2.6;
    return {
      instance: stateProgress >= 1 ? { ...instance, currentState: "fading" as const, stateProgress: 0 } : { ...instance, stateProgress },
      instances: [],
      essenceGained: 0,
      patternsGained: 0,
      harvests: [],
    };
  }
  if (instance.currentState === "fading") {
    const stateProgress = instance.stateProgress + deltaSeconds * 1.9;
    if (stateProgress < 1) {
      return { instance: { ...instance, stateProgress }, instances: [], essenceGained: 0, patternsGained: 0, harvests: [] };
    }
    return {
      instance: {
        ...instance,
        currentState: "building" as const,
        stateProgress: 0,
        cycleProgress: 0,
        currentBuiltBranches: 0,
        currentSeed: nextSeed(instance.currentSeed),
      },
      instances: [],
      essenceGained: 0,
      patternsGained: 0,
      harvests: [],
    };
  }

  const speed = getCoreBuildSpeed(instance, upgrades, equippedFormulaIds, ownedCoreCount, axiomSpeedMultiplier, runtimeBonuses);
  const cycleProgress = instance.cycleProgress + deltaSeconds * speed;
  const built = Math.min(complexity, Math.floor(cycleProgress));
  if (built >= complexity) {
    const harvest = getCoreHarvestValue(instance, upgrades, equippedFormulaIds, axioms, runtimeBonuses);
    return {
      instance: { ...instance, currentBuiltBranches: complexity, cycleProgress: complexity, currentState: "harvesting" as const, stateProgress: 0 },
      instances: [],
      essenceGained: harvest.essence,
      patternsGained: harvest.patterns,
      harvests: [{ instanceId: instance.id, definitionId: instance.definitionId, essence: harvest.essence, patterns: harvest.patterns }],
    };
  }
  return { instance: { ...instance, cycleProgress, currentBuiltBranches: built }, instances: [], essenceGained: 0, patternsGained: 0, harvests: [] };
}

function tickHiddenCoreInstance(instance: CoreInstance, context: TickContext): CoreTickResult & { instance: CoreInstance } {
  const { upgrades, equippedFormulaIds, axioms, deltaSeconds, axiomSpeedMultiplier, runtimeBonuses, ownedCoreCount } = context;
  const complexity = getCoreComplexity(instance, upgrades);
  const speed = getCoreBuildSpeed(instance, upgrades, equippedFormulaIds, ownedCoreCount, axiomSpeedMultiplier, runtimeBonuses);
  const cooldownProgress = instance.currentState === "building" ? 0 : Math.min(0.9 * speed, Math.max(0, instance.stateProgress) * 0.9 * speed);
  const cycleUnits = Math.max(1, complexity + speed * 0.9);
  const startingProgress = Math.min(cycleUnits - 0.0001, Math.max(0, instance.cycleProgress + cooldownProgress));
  const progressed = startingProgress + deltaSeconds * speed;
  const completedCycles = Math.floor(progressed / cycleUnits);
  const remaining = progressed % cycleUnits;
  const built = Math.min(complexity, Math.floor(remaining));
  let seed = instance.currentSeed;
  for (let index = 0; index < Math.min(completedCycles, 32); index += 1) seed = nextSeed(seed);
  if (completedCycles > 32) seed = (seed + completedCycles * 2654435761) >>> 0;

  if (completedCycles <= 0) {
    return {
      instance: { ...instance, cycleProgress: remaining, currentBuiltBranches: built, currentState: "building" as const, stateProgress: 0 },
      instances: [],
      essenceGained: 0,
      patternsGained: 0,
      harvests: [],
    };
  }

  const harvest = getCoreHarvestValue(instance, upgrades, equippedFormulaIds, axioms, runtimeBonuses);
  const essence = harvest.essence * completedCycles;
  const patterns = harvest.patterns * completedCycles;
  return {
    instance: { ...instance, cycleProgress: remaining, currentBuiltBranches: built, currentState: "building" as const, stateProgress: 0, currentSeed: seed },
    instances: [],
    essenceGained: essence,
    patternsGained: patterns,
    harvests: [{ instanceId: instance.id, definitionId: instance.definitionId, essence, patterns }],
  };
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}
