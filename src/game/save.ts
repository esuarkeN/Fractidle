import { FORMULA_SLOTS, getFormulaSlotCount, MAX_EXTRA_FORMULA_SLOTS, OFFLINE_CAP_SECONDS, SAVE_VERSION, STARTING_NODES } from "./balancing";
import { createCoreInstance, createInitialCoreInstances, createInitialCoreUpgrades } from "./coreBalancing";
import { CORE_LAYERS } from "./coreLayers";
import { getUnlockedLayerIds, getTotalEssencePerSecond, normalizeCoreInstances, normalizeCoreUpgrades } from "./coreSimulation";
import { getAxiomSpeedMultiplier, getEffectiveAxioms, getRuntimeProductionBonuses } from "./coreRuntime";
import type { CoreInstance } from "./coreTypes";
import { createInitialFractal } from "./fractalGenerator";
import { getResearchEffects } from "./research";
import { getEssenceReachedThisRun, getPatternsReachedThisRun } from "./progression";
import { createInitialStrainMastery, normalizeStrainMastery } from "./strainMastery";
import type { GameStateSnapshot, OfflineGain, SaveFile } from "./types";

export const SAVE_KEY = "recursive-bloom-save-v1";

function isDevBuild(): boolean {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}

export function createInitialState(): GameStateSnapshot {
  return {
    resources: { essence: 20, patterns: 0, axioms: 0 },
    nodes: STARTING_NODES,
    totalEssenceEarned: 0,
    totalPatternsEarned: 0,
    totalRuntimeSeconds: 0,
    lifetimeCollapseCount: 0,
    totalStableMutationsEarned: 0,
    currentRunLifetimeEssence: 0,
    currentRunHighestExtractionPerSecond: 0,
    currentRunHighestComplexity: STARTING_NODES,
    tutorialFlags: {},
    unlockedFormulaIds: [],
    equippedFormulaIds: Array.from({ length: FORMULA_SLOTS }, () => null),
    fractal: createInitialFractal(),
    coreInstances: createInitialCoreInstances(),
    coreUpgrades: createInitialCoreUpgrades(),
    axiomUpgrades: {
      growth: 0,
      form: 0,
      memory: 0,
      multiplicity: 0,
      patterns: 0,
      layers: 0,
      recursion: 0,
      chamberMemory: 0,
      patternImprint: 0,
      containment: 0,
      genomeArchive: 0,
      deepCulture: 0,
    },
    researchPurchasedIds: [],
    strainMastery: createInitialStrainMastery(),
    discoveredSynergyIds: [],
    mutationEvents: [],
    highestEssencePerSecond: 0,
    selectedLayerId: "root-grove",
    unlockedLayerIds: ["root-grove"],
    lastSavedAt: Date.now(),
    saveVersion: SAVE_VERSION,
    offlineNotice: null,
    feedback: { nodePulse: 0, harvestPulse: 0, formulaPulse: 0, collapsePulse: 0, lastCollapseReward: 0, lastGrowthCount: 0 },
  };
}

function normalizeSave(save: Partial<SaveFile>): GameStateSnapshot {
  const initial = createInitialState();
  const equipped = Array.isArray(save.equippedFormulaIds)
    ? save.equippedFormulaIds.slice(0, getFormulaSlotCount(MAX_EXTRA_FORMULA_SLOTS))
    : initial.equippedFormulaIds;
  while (equipped.length < FORMULA_SLOTS) equipped.push(null);

  const savedCoreInstances = "coreInstances" in save ? save.coreInstances : undefined;
  const legacyCores = "cores" in save ? (save as Partial<SaveFile> & { cores?: Array<{ type?: string; branchCap?: number; level?: number }> }).cores : undefined;
  const migratedInstances: CoreInstance[] | undefined = savedCoreInstances ?? legacyCores?.filter((core) => core.type === "root" || core.type === "spiral" || core.type === "crystal" || core.type === "echo").map((core, index) => {
    const definitionId = core.type === "spiral" ? "spiral-core" : core.type === "crystal" ? "crystal-core" : core.type === "echo" ? "echo-core" : "root-core";
    return { ...createCoreInstance(definitionId, index + 1), complexity: core.branchCap ?? save.nodes ?? STARTING_NODES, level: core.level ?? 1 };
  });
  const coreInstances = normalizeCoreInstances(migratedInstances ?? initial.coreInstances);
  const coreUpgrades = normalizeCoreUpgrades(save.coreUpgrades ?? initial.coreUpgrades);
  const axiomUpgrades = { ...initial.axiomUpgrades, ...(save as Partial<SaveFile>).axiomUpgrades };
  const researchPurchasedIds = Array.isArray((save as Partial<SaveFile>).researchPurchasedIds) ? (save as Partial<SaveFile>).researchPurchasedIds ?? [] : [];
  const researchEffects = getResearchEffects(researchPurchasedIds);
  while (equipped.length < getFormulaSlotCount(researchEffects.extraGeneSlots)) equipped.push(null);
  const strainMastery = normalizeStrainMastery((save as Partial<SaveFile>).strainMastery);
  const knownLayerIds = new Set(CORE_LAYERS.map((layer) => layer.id));
  const selectedLayerId = save.selectedLayerId && save.selectedLayerId !== "all" && knownLayerIds.has(save.selectedLayerId) ? save.selectedLayerId : initial.selectedLayerId;
  const resources = {
    essence: save.resources?.essence ?? initial.resources.essence,
    patterns: save.resources?.patterns ?? initial.resources.patterns,
    axioms: save.resources?.axioms ?? initial.resources.axioms,
  };
  const currentRunLifetimeEssence = (save as Partial<SaveFile>).currentRunLifetimeEssence ?? save.totalEssenceEarned ?? 0;
  const totalPatternsEarned = save.totalPatternsEarned ?? 0;
  const progressState = {
    resources,
    currentRunLifetimeEssence,
    totalEssenceEarned: save.totalEssenceEarned ?? 0,
    totalPatternsEarned,
  };
  const unlockedLayerIds = getUnlockedLayerIds(coreInstances, getEssenceReachedThisRun(progressState), getPatternsReachedThisRun(progressState), resources.axioms);

  return {
    ...initial,
    ...save,
    resources,
    lifetimeCollapseCount: (save as Partial<SaveFile>).lifetimeCollapseCount ?? 0,
    totalStableMutationsEarned: (save as Partial<SaveFile>).totalStableMutationsEarned ?? save.resources?.axioms ?? 0,
    currentRunLifetimeEssence,
    currentRunHighestExtractionPerSecond: (save as Partial<SaveFile>).currentRunHighestExtractionPerSecond ?? (save as Partial<SaveFile>).highestEssencePerSecond ?? 0,
    currentRunHighestComplexity: (save as Partial<SaveFile>).currentRunHighestComplexity ?? Math.max(save.nodes ?? initial.nodes, ...coreInstances.map((instance) => instance.complexity)),
    tutorialFlags: (save as Partial<SaveFile>).tutorialFlags ?? {},
    unlockedFormulaIds: Array.isArray(save.unlockedFormulaIds) ? save.unlockedFormulaIds : [],
    equippedFormulaIds: equipped,
    fractal: createInitialFractal(),
    coreInstances,
    coreUpgrades,
    axiomUpgrades,
    researchPurchasedIds,
    strainMastery,
    discoveredSynergyIds: Array.isArray((save as Partial<SaveFile>).discoveredSynergyIds) ? (save as Partial<SaveFile>).discoveredSynergyIds ?? [] : [],
    mutationEvents: Array.isArray((save as Partial<SaveFile>).mutationEvents) ? ((save as Partial<SaveFile>).mutationEvents ?? []).slice(-20) : [],
    highestEssencePerSecond: Math.max(0, (save as Partial<SaveFile>).highestEssencePerSecond ?? 0),
    selectedLayerId,
    unlockedLayerIds: save.unlockedLayerIds ?? unlockedLayerIds,
    saveVersion: SAVE_VERSION,
    offlineNotice: null,
  };
}

export function loadGame(): { state: GameStateSnapshot; offlineGain: OfflineGain | null } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: createInitialState(), offlineGain: null };
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    const loaded = normalizeSave(parsed);
    const researchEffects = getResearchEffects(loaded.researchPurchasedIds);
    const elapsedSeconds = Math.min(OFFLINE_CAP_SECONDS * (1 + researchEffects.offlineCapMultiplier), Math.max(0, (Date.now() - (loaded.lastSavedAt || Date.now())) / 1000));
    const estimatedEssencePerSecond = getTotalEssencePerSecond(
      loaded.coreInstances,
      loaded.coreUpgrades,
      loaded.equippedFormulaIds,
      getEffectiveAxioms(loaded),
      getAxiomSpeedMultiplier(loaded),
      getRuntimeProductionBonuses(loaded),
    );
    const offlineGain = elapsedSeconds >= 10 && estimatedEssencePerSecond > 0
      ? { seconds: elapsedSeconds, essence: estimatedEssencePerSecond * elapsedSeconds }
      : null;
    const state = offlineGain
      ? {
          ...loaded,
          resources: { ...loaded.resources, essence: loaded.resources.essence + offlineGain.essence },
          totalEssenceEarned: loaded.totalEssenceEarned + offlineGain.essence,
          currentRunLifetimeEssence: loaded.currentRunLifetimeEssence + offlineGain.essence,
          totalRuntimeSeconds: loaded.totalRuntimeSeconds + elapsedSeconds,
        }
      : loaded;
    return { state: { ...state, lastSavedAt: Date.now(), offlineNotice: offlineGain }, offlineGain };
  } catch {
    return { state: createInitialState(), offlineGain: null };
  }
}

export function saveGame(state: GameStateSnapshot): void {
  const save: SaveFile = {
    resources: state.resources,
    nodes: state.nodes,
    totalEssenceEarned: state.totalEssenceEarned,
    totalPatternsEarned: state.totalPatternsEarned,
    totalRuntimeSeconds: state.totalRuntimeSeconds,
    lifetimeCollapseCount: state.lifetimeCollapseCount,
    totalStableMutationsEarned: state.totalStableMutationsEarned,
    currentRunLifetimeEssence: state.currentRunLifetimeEssence,
    currentRunHighestExtractionPerSecond: state.currentRunHighestExtractionPerSecond,
    currentRunHighestComplexity: state.currentRunHighestComplexity,
    tutorialFlags: state.tutorialFlags,
    unlockedFormulaIds: state.unlockedFormulaIds,
    equippedFormulaIds: state.equippedFormulaIds,
    fractal: createInitialFractal(),
    coreInstances: state.coreInstances,
    coreUpgrades: state.coreUpgrades,
    axiomUpgrades: state.axiomUpgrades,
    researchPurchasedIds: state.researchPurchasedIds,
    strainMastery: state.strainMastery,
    discoveredSynergyIds: state.discoveredSynergyIds,
    mutationEvents: state.mutationEvents.slice(-20),
    highestEssencePerSecond: state.highestEssencePerSecond,
    selectedLayerId: state.selectedLayerId,
    unlockedLayerIds: state.unlockedLayerIds,
    lastSavedAt: Date.now(),
    saveVersion: SAVE_VERSION,
  };
  try {
    const serialized = JSON.stringify(save);
    if (isDevBuild() && serialized.length > 1_000_000) {
      console.warn(`Recursive Bloom save is ${(serialized.length / 1024 / 1024).toFixed(2)}MB. Render-only data may be leaking into persistence.`);
    }
    localStorage.setItem(SAVE_KEY, serialized);
  } catch {
    // Storage can be disabled or full; gameplay should continue without persistence.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
