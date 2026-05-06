import { CORE_DEFINITIONS } from "./coreDefinitions";
import { softCap } from "./balancing";
import type { CoreDefinitionId, CoreInstance, CoreTypeUpgrade } from "./coreTypes";

export function createCoreInstance(definitionId: CoreDefinitionId, instanceIndex: number, now = Date.now()): CoreInstance {
  const definition = CORE_DEFINITIONS[definitionId];
  return {
    id: `${definitionId}-${instanceIndex}`,
    definitionId,
    instanceIndex,
    level: 1,
    complexity: definition.baseComplexity,
    buildSpeedMultiplier: 1,
    yieldMultiplier: 1,
    cycleProgress: 0,
    currentSeed: (now + instanceIndex * 7919 + definition.baseCost * 13) >>> 0,
    currentBuiltBranches: 0,
    currentState: "building",
    stateProgress: 0,
    createdAt: now,
  };
}

export function createInitialCoreInstances(): CoreInstance[] {
  return [createCoreInstance("root-core", 1)];
}

export function createInitialCoreUpgrades(): CoreTypeUpgrade[] {
  return Object.keys(CORE_DEFINITIONS).map((definitionId) => ({
    definitionId: definitionId as CoreDefinitionId,
    complexityBonus: 0,
    yieldLevel: 0,
    speedLevel: 0,
  }));
}

export function getOwnedCoreCount(instances: CoreInstance[], definitionId: CoreDefinitionId): number {
  return instances.filter((instance) => instance.definitionId === definitionId).length;
}

export function getCoreInstanceCost(instances: CoreInstance[], definitionId: CoreDefinitionId): number {
  const definition = CORE_DEFINITIONS[definitionId];
  const owned = getOwnedCoreCount(instances, definitionId);
  return Math.floor(definition.baseCost * Math.pow(definition.costMultiplier, owned));
}

export function getComplexityUpgradeCost(upgrade: CoreTypeUpgrade, definitionId: CoreDefinitionId): number {
  const definition = CORE_DEFINITIONS[definitionId];
  return Math.floor(definition.baseCost * 0.95 * Math.pow(1.22, upgrade.complexityBonus) * Math.pow(1.035, Math.max(0, upgrade.complexityBonus - 12)));
}

export function getYieldUpgradeCost(upgrade: CoreTypeUpgrade, definitionId: CoreDefinitionId): number {
  const definition = CORE_DEFINITIONS[definitionId];
  return Math.floor(definition.baseCost * 1.2 * Math.pow(1.3, upgrade.yieldLevel) * Math.pow(1.045, Math.max(0, upgrade.yieldLevel - 10)));
}

export function getSpeedUpgradeCost(upgrade: CoreTypeUpgrade, definitionId: CoreDefinitionId): number {
  const definition = CORE_DEFINITIONS[definitionId];
  return Math.floor(definition.baseCost * 1.1 * Math.pow(1.28, upgrade.speedLevel) * Math.pow(1.05, Math.max(0, upgrade.speedLevel - 10)));
}

export function getCoreComplexity(instance: CoreInstance, upgrades: CoreTypeUpgrade[]): number {
  const upgrade = upgrades.find((item) => item.definitionId === instance.definitionId);
  return instance.complexity + (upgrade?.complexityBonus ?? 0);
}

export function getCoreSpeedMultiplier(instance: CoreInstance, upgrades: CoreTypeUpgrade[]): number {
  const upgrade = upgrades.find((item) => item.definitionId === instance.definitionId);
  return instance.buildSpeedMultiplier * (1 + softCap((upgrade?.speedLevel ?? 0) * 0.11, 1.2, 0.55));
}

export function getCoreYieldMultiplier(instance: CoreInstance, upgrades: CoreTypeUpgrade[]): number {
  const upgrade = upgrades.find((item) => item.definitionId === instance.definitionId);
  return instance.yieldMultiplier * (1 + softCap((upgrade?.yieldLevel ?? 0) * 0.13, 1.35, 0.55));
}

export function getCoreOutputTierMultiplier(outputTier: number): number {
  return Math.pow(1.34, Math.max(0, outputTier));
}
