import { create } from "zustand";
import { FORMULA_SLOTS, getAxiomUpgradeCost } from "../game/balancing";
import {
  createCoreInstance,
  getComplexityUpgradeCost,
  getCoreInstanceCost,
  getOwnedCoreCount,
  getSpeedUpgradeCost,
  getYieldUpgradeCost,
} from "../game/coreBalancing";
import { CORE_DEFINITIONS } from "../game/coreDefinitions";
import { getUnlockedLayerIds, isCoreDefinitionAvailable, tickCoreInstancesForSelectedChamber } from "../game/coreSimulation";
import type { CoreDefinitionId, CoreLayerId } from "../game/coreTypes";
import { createInitialFractal } from "../game/fractalGenerator";
import { getFormula } from "../game/formulas";
import { getActiveGeneSynergies } from "../game/geneSynergies";
import { getEssenceReachedThisRun, getPatternsReachedThisRun } from "../game/progression";
import { canPurchaseResearch, getResearchEffects, getResearchNode } from "../game/research";
import { canUnlockFormula } from "../game/selectors";
import { clearSave, createInitialState, loadGame, saveGame } from "../game/save";
import { calculateStableMutationsGain, calculateProduction, simulate } from "../game/simulation";
import type { GameStateSnapshot } from "../game/types";
import type { AxiomUpgradeId } from "../game/types";

type GameActions = {
  hydrate: () => void;
  tick: (deltaSeconds: number) => void;
  setSelectedLayer: (layerId: CoreLayerId) => void;
  buyCoreInstance: (definitionId: CoreDefinitionId) => void;
  increaseCoreComplexity: (definitionId: CoreDefinitionId) => void;
  upgradeCoreSpeed: (definitionId: CoreDefinitionId) => void;
  upgradeCoreYield: (definitionId: CoreDefinitionId) => void;
  buyAxiomUpgrade: (upgradeId: AxiomUpgradeId) => void;
  purchaseResearch: (researchId: string) => void;
  buyNode: () => void;
  unlockFormula: (formulaId: string) => void;
  equipFormula: (formulaId: string, slotIndex?: number) => void;
  unequipFormula: (slotIndex: number) => void;
  collapse: () => void;
  save: () => void;
  reset: () => void;
  dismissOfflineNotice: () => void;
};

export type GameStore = GameStateSnapshot & GameActions;

const initialState = createInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  hydrate: () => {
    const { state } = loadGame();
    set(state);
  },
  tick: (deltaSeconds) => {
    set((state) => {
      const simulated = simulate(state, deltaSeconds);
      const researchEffects = getResearchEffects(simulated.researchPurchasedIds);
      const effectiveAxioms = simulated.resources.axioms + simulated.axiomUpgrades.form * 1.5 + simulated.axiomUpgrades.recursion * 0.8;
      const axiomSpeedMultiplier = 1 + simulated.axiomUpgrades.growth * 0.08;
      const coreTick = tickCoreInstancesForSelectedChamber(
        simulated.coreInstances,
        simulated.coreUpgrades,
        simulated.equippedFormulaIds,
        effectiveAxioms,
        deltaSeconds,
        simulated.selectedLayerId,
        axiomSpeedMultiplier,
        {
          growthMultiplier: researchEffects.growthMultiplier,
          extractionMultiplier: researchEffects.extractionMultiplier,
          patternMultiplier: researchEffects.patternMultiplier,
          instabilityBonus: researchEffects.instabilityBonus + simulated.axiomUpgrades.containment * 0.08,
          strainMastery: simulated.strainMastery,
        },
      );
      const didHarvest = coreTick.harvests.length > 0;
      const nextResources = {
        ...simulated.resources,
        essence: simulated.resources.essence + coreTick.essenceGained,
        patterns: simulated.resources.patterns + coreTick.patternsGained,
      };
      const nextMastery = { ...simulated.strainMastery };
      for (const harvest of coreTick.harvests) {
        const instance = coreTick.instances.find((item) => item.id === harvest.instanceId);
        const mastery = nextMastery[harvest.definitionId] ?? { harvests: 0, lifetimeEssence: 0, highestComplexity: 0, peakOwned: 0 };
        const ownedCount = coreTick.instances.filter((item) => item.definitionId === harvest.definitionId).length;
        nextMastery[harvest.definitionId] = {
          harvests: mastery.harvests + 1,
          lifetimeEssence: mastery.lifetimeEssence + harvest.essence,
          highestComplexity: Math.max(mastery.highestComplexity, instance?.complexity ?? 0),
          peakOwned: Math.max(mastery.peakOwned, ownedCount),
        };
      }
      const activeSynergies = getActiveGeneSynergies(simulated.equippedFormulaIds).map((synergy) => synergy.id);
      const mutationEvents = maybeCreateMutationEvents(simulated, coreTick.harvests, researchEffects.instabilityBonus);
      const mutationEssence = mutationEvents.reduce((total, event) => total + event.essence, 0);
      const mutationPatterns = mutationEvents.reduce((total, event) => total + event.patterns, 0);
      const nextRunLifetimeEssence = simulated.currentRunLifetimeEssence + coreTick.essenceGained + mutationEssence;
      const nextRunPatternsEarned = simulated.totalPatternsEarned + coreTick.patternsGained + mutationPatterns;
      const essenceReached = Math.max(nextRunLifetimeEssence, nextResources.essence + mutationEssence, simulated.totalEssenceEarned + coreTick.essenceGained + mutationEssence);
      const patternsReached = Math.max(nextResources.patterns + mutationPatterns, nextRunPatternsEarned);
      const unlockedLayerIds = [
        ...new Set([
          ...simulated.unlockedLayerIds,
          ...getUnlockedLayerIds(coreTick.instances, essenceReached, patternsReached, simulated.resources.axioms),
          ...researchEffects.unlockChamberIds,
        ]),
      ] as CoreLayerId[];
      const nextState = {
        ...simulated,
        coreInstances: coreTick.instances,
        unlockedLayerIds,
        resources: {
          ...nextResources,
          essence: nextResources.essence + mutationEssence,
          patterns: nextResources.patterns + mutationPatterns,
        },
        strainMastery: nextMastery,
        discoveredSynergyIds: [...new Set([...simulated.discoveredSynergyIds, ...activeSynergies])],
        mutationEvents: [...simulated.mutationEvents, ...mutationEvents].slice(-20),
        totalEssenceEarned: simulated.totalEssenceEarned + coreTick.essenceGained + mutationEssence,
        totalPatternsEarned: nextRunPatternsEarned,
        currentRunLifetimeEssence: nextRunLifetimeEssence,
        feedback: didHarvest
          ? {
              ...simulated.feedback,
              harvestPulse: simulated.feedback.harvestPulse + 1,
              lastGrowthCount: coreTick.harvests.length,
            }
          : simulated.feedback,
      };
      const production = calculateProduction(nextState);
      const highestComplexity = Math.max(nextState.currentRunHighestComplexity, nextState.nodes, ...nextState.coreInstances.map((instance) => instance.complexity));
      return {
        ...nextState,
        highestEssencePerSecond: Math.max(nextState.highestEssencePerSecond, production.essencePerSecond),
        currentRunHighestExtractionPerSecond: Math.max(nextState.currentRunHighestExtractionPerSecond, production.essencePerSecond),
        currentRunHighestComplexity: highestComplexity,
      };
    });
  },
  setSelectedLayer: (layerId) => set({ selectedLayerId: layerId === "all" ? "root-grove" : layerId }),
  buyCoreInstance: (definitionId) => {
    const state = get();
    const definition = CORE_DEFINITIONS[definitionId];
    const essenceReached = getEssenceReachedThisRun(state);
    const patternsReached = getPatternsReachedThisRun(state);
    if (!isCoreDefinitionAvailable(definitionId, essenceReached, patternsReached, state.coreInstances.length, state.unlockedLayerIds.length, state.resources.axioms)) return;
    const researchEffects = getResearchEffects(state.researchPurchasedIds);
    const cost = Math.floor(getCoreInstanceCost(state.coreInstances, definitionId) * (1 - Math.min(0.25, researchEffects.cloneCostReduction)));
    if (state.resources.essence < cost) return;
    const instanceIndex = getOwnedCoreCount(state.coreInstances, definitionId) + 1;
    const instance = createCoreInstance(definitionId, instanceIndex);
    const nextInstances = [...state.coreInstances, instance];
    set({
      resources: { ...state.resources, essence: state.resources.essence - cost },
      coreInstances: nextInstances,
      selectedLayerId: definition.layerId,
      unlockedLayerIds: [...new Set([...state.unlockedLayerIds, ...getUnlockedLayerIds(nextInstances, essenceReached, patternsReached, state.resources.axioms), ...researchEffects.unlockChamberIds])] as CoreLayerId[],
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  increaseCoreComplexity: (definitionId) => {
    const state = get();
    const upgrade = state.coreUpgrades.find((item) => item.definitionId === definitionId);
    if (!upgrade) return;
    const cost = Math.floor(getComplexityUpgradeCost(upgrade, definitionId) * (1 - Math.min(0.32, state.axiomUpgrades.deepCulture * 0.04)));
    if (state.resources.essence < cost) return;
    set({
      resources: { ...state.resources, essence: state.resources.essence - cost },
      nodes: definitionId === "root-core" ? state.nodes + 1 : state.nodes,
      coreUpgrades: state.coreUpgrades.map((item) => item.definitionId === definitionId ? { ...item, complexityBonus: item.complexityBonus + 1 } : item),
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  upgradeCoreYield: (definitionId) => {
    const state = get();
    const upgrade = state.coreUpgrades.find((item) => item.definitionId === definitionId);
    if (!upgrade) return;
    const cost = getYieldUpgradeCost(upgrade, definitionId);
    if (state.resources.essence < cost) return;
    set({
      resources: { ...state.resources, essence: state.resources.essence - cost },
      coreUpgrades: state.coreUpgrades.map((item) => item.definitionId === definitionId ? { ...item, yieldLevel: item.yieldLevel + 1 } : item),
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  upgradeCoreSpeed: (definitionId) => {
    const state = get();
    const upgrade = state.coreUpgrades.find((item) => item.definitionId === definitionId);
    if (!upgrade || getOwnedCoreCount(state.coreInstances, definitionId) <= 0) return;
    const cost = getSpeedUpgradeCost(upgrade, definitionId);
    if (state.resources.essence < cost) return;
    set({
      resources: { ...state.resources, essence: state.resources.essence - cost },
      coreUpgrades: state.coreUpgrades.map((item) => item.definitionId === definitionId ? { ...item, speedLevel: item.speedLevel + 1 } : item),
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  buyAxiomUpgrade: (upgradeId) => {
    const state = get();
    const current = state.axiomUpgrades[upgradeId] ?? 0;
    const cost = getAxiomUpgradeCost(current);
    if (state.resources.axioms < cost) return;
    set({
      resources: { ...state.resources, axioms: state.resources.axioms - cost },
      axiomUpgrades: { ...state.axiomUpgrades, [upgradeId]: current + 1 },
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  purchaseResearch: (researchId) => {
    const state = get();
    const node = getResearchNode(researchId);
    if (!node || !canPurchaseResearch(state, researchId)) return;
    const effects = getResearchEffects([...state.researchPurchasedIds, researchId]);
    const nextEquipped = [...state.equippedFormulaIds];
    while (nextEquipped.length < 3 + Math.min(2, effects.extraGeneSlots)) nextEquipped.push(null);
    set({
      resources: { ...state.resources, patterns: state.resources.patterns - node.cost },
      researchPurchasedIds: [...state.researchPurchasedIds, researchId],
      equippedFormulaIds: nextEquipped,
      unlockedLayerIds: [...(new Set([...state.unlockedLayerIds, ...effects.unlockChamberIds]) as Set<CoreLayerId>)],
      feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 },
    });
  },
  buyNode: () => get().increaseCoreComplexity("root-core"),
  unlockFormula: (formulaId) => {
    const state = get();
    const formula = getFormula(formulaId);
    if (!formula || !canUnlockFormula(state, formulaId)) return;
    set({
      resources: { ...state.resources, essence: state.resources.essence - formula.unlockCost },
      unlockedFormulaIds: [...state.unlockedFormulaIds, formulaId],
    });
  },
  equipFormula: (formulaId, slotIndex) => {
    const state = get();
    if (!state.unlockedFormulaIds.includes(formulaId)) return;
    const equipped = state.equippedFormulaIds.map((id) => (id === formulaId ? null : id));
    const targetSlot = slotIndex ?? equipped.findIndex((id) => id === null);
    if (targetSlot < 0 || targetSlot >= equipped.length) return;
    equipped[targetSlot] = formulaId;
    set({ equippedFormulaIds: equipped, feedback: { ...state.feedback, formulaPulse: state.feedback.formulaPulse + 1 } });
  },
  unequipFormula: (slotIndex) => {
    const state = get();
    if (slotIndex < 0 || slotIndex >= FORMULA_SLOTS) return;
    const equipped = [...state.equippedFormulaIds];
    equipped[slotIndex] = null;
    set({ equippedFormulaIds: equipped });
  },
  collapse: () => {
    const state = get();
    const reward = calculateStableMutationsGain(state);
    if (reward <= 0) return;
    const complexityMemory = Math.min(0.55, state.axiomUpgrades.memory * 0.06 + state.axiomUpgrades.deepCulture * 0.025);
    const keepChambers = state.axiomUpgrades.chamberMemory > 0;
    const rememberedLayers = keepChambers
      ? state.unlockedLayerIds.filter((layerId) => layerId === "root-grove" || state.axiomUpgrades.chamberMemory >= 2 || layerId === "spiralarium" || layerId === "crystal-lattice")
      : ["root-grove" as CoreLayerId];
    const starterDefinitions = state.axiomUpgrades.multiplicity > 0
      ? rememberedLayers
          .map((layerId) => Object.values(CORE_DEFINITIONS).find((definition) => definition.layerId === layerId)?.id)
          .filter((id): id is CoreDefinitionId => Boolean(id))
      : ["root-core" as CoreDefinitionId];
    const nextInstances = starterDefinitions.map((definitionId, index) => createCoreInstance(definitionId, index + 1));
    const retainedFormulaCount = Math.min(state.unlockedFormulaIds.length, state.axiomUpgrades.memory > 0 ? Math.ceil(state.unlockedFormulaIds.length * Math.min(0.65, state.axiomUpgrades.memory * 0.12)) : 0);
    const retainedResearchCount = Math.min(state.researchPurchasedIds.length, state.axiomUpgrades.genomeArchive > 0 ? Math.ceil(state.researchPurchasedIds.length * Math.min(0.75, state.axiomUpgrades.genomeArchive * 0.18)) : 0);
    const retainedResearch = state.researchPurchasedIds.slice(0, retainedResearchCount);
    const retainedResearchEffects = getResearchEffects(retainedResearch);
    const nextEquippedLength = Math.max(FORMULA_SLOTS, FORMULA_SLOTS + Math.min(2, retainedResearchEffects.extraGeneSlots));
    set({
      resources: { essence: 0, patterns: state.axiomUpgrades.patternImprint * 6, axioms: state.resources.axioms + reward },
      nodes: Math.max(1, Math.floor(state.nodes * complexityMemory)),
      fractal: createInitialFractal(),
      coreInstances: nextInstances,
      coreUpgrades: state.coreUpgrades.map((upgrade) => ({
        ...upgrade,
        complexityBonus: Math.floor(upgrade.complexityBonus * complexityMemory),
        speedLevel: 0,
        yieldLevel: 0,
      })),
      totalEssenceEarned: 0,
      totalPatternsEarned: 0,
      totalRuntimeSeconds: 0,
      lifetimeCollapseCount: state.lifetimeCollapseCount + 1,
      totalStableMutationsEarned: state.totalStableMutationsEarned + reward,
      currentRunLifetimeEssence: 0,
      currentRunHighestExtractionPerSecond: 0,
      currentRunHighestComplexity: Math.max(1, Math.floor(state.nodes * complexityMemory)),
      unlockedFormulaIds: state.unlockedFormulaIds.slice(0, retainedFormulaCount),
      equippedFormulaIds: Array.from({ length: nextEquippedLength }, () => null),
      researchPurchasedIds: retainedResearch,
      strainMastery: state.strainMastery,
      discoveredSynergyIds: state.discoveredSynergyIds,
      mutationEvents: [],
      selectedLayerId: "root-grove",
      unlockedLayerIds: [...new Set(["root-grove" as CoreLayerId, ...rememberedLayers, ...retainedResearchEffects.unlockChamberIds])] as CoreLayerId[],
      lastSavedAt: Date.now(),
      offlineNotice: null,
      feedback: {
        ...state.feedback,
        collapsePulse: state.feedback.collapsePulse + 1,
        lastCollapseReward: reward,
        lastGrowthCount: 0,
      },
    });
  },
  save: () => {
    const state = get();
    saveGame(state);
    set({ lastSavedAt: Date.now() });
  },
  reset: () => {
    clearSave();
    set(createInitialState());
  },
  dismissOfflineNotice: () => set({ offlineNotice: null }),
}));

function maybeCreateMutationEvents(state: GameStateSnapshot, harvests: Array<{ instanceId: string; definitionId: CoreDefinitionId; essence: number; patterns: number }>, instabilityBonus: number) {
  const events = [];
  for (const harvest of harvests) {
    const definition = CORE_DEFINITIONS[harvest.definitionId];
    const unstable = definition.fractalType === "lightning" || definition.fractalType === "mutation" || state.equippedFormulaIds.includes("entropic-bargain");
    if (!unstable) continue;
    const roll = (Date.now() + harvest.instanceId.length * 7919 + harvest.essence) % 100;
    const chance = 10 + instabilityBonus * 18 + (definition.fractalType === "mutation" ? 12 : 0);
    if (roll > chance) continue;
    const severe = roll < 8;
    events.push({
      id: `${harvest.instanceId}-${Date.now()}-${events.length}`,
      sourceCultureId: harvest.instanceId,
      type: severe ? "Aberrant Bloom" as const : "Split Genome" as const,
      severity: severe ? 2 : 1,
      essence: harvest.essence * (severe ? 0.5 : 0.18),
      patterns: harvest.patterns + (severe ? 0.6 : 0.18),
      message: severe ? "Aberrant bloom stabilized." : "Split genome produced Genetic Patterns.",
      createdAt: Date.now(),
    });
  }
  return events;
}
