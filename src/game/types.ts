import type { FractalState } from "./fractalTypes";
import type { CoreInstance, CoreLayerId, CoreTypeUpgrade } from "./coreTypes";

export type FormulaTag = "cell" | "branch" | "pattern" | "symmetry" | "spiral" | "nested" | "mirror" | "core" | "collapse";
export type FormulaVisualTag = "branch" | "symmetry" | "spiral" | "pattern" | "recursive" | "mutation" | "stability";

export type FormulaEffect = {
  essenceMultiplier?: number;
  essenceFlatBonus?: number;
  nodeProductionBonus?: number;
  perTenNodesMultiplier?: number;
  nodeMilestoneEvery?: number;
  nodeMilestoneMultiplier?: number;
  patternPerSecond?: number;
  patternUnlock?: boolean;
  patternEssenceMultiplier?: number;
  patternEssenceCap?: number;
  symmetryMultiplier?: number;
  spiralPerMinuteMultiplier?: number;
  nestedPerFormulaMultiplier?: number;
  mirrorStrength?: number;
  firstNodeFlatBonus?: number;
  axiomFlatBonus?: number;
  collapseRewardMultiplier?: number;
  patternCollapseRewardMultiplier?: number;
  patternCollapseRewardCap?: number;
  synergyTags?: FormulaTag[];
  synergyMultiplier?: number;
  diversityMultiplier?: number;
};

export type Formula = {
  id: string;
  name: string;
  tag: FormulaTag;
  description: string;
  unlockCost: number;
  unlockRequires?: {
    nodes?: number;
    essenceEarned?: number;
    patternsEarned?: number;
    axioms?: number;
  };
  effect: FormulaEffect;
  visualTags?: FormulaVisualTag[];
  shortEffect?: string;
};

export type Resources = {
  essence: number;
  patterns: number;
  axioms: number;
};

export type AxiomUpgradeId =
  | "growth"
  | "form"
  | "memory"
  | "multiplicity"
  | "patterns"
  | "layers"
  | "recursion"
  | "chamberMemory"
  | "patternImprint"
  | "containment"
  | "genomeArchive"
  | "deepCulture";

export type ResearchCategory =
  | "culture"
  | "genes"
  | "extraction"
  | "chambers"
  | "recursive"
  | "mutation"
  | "automation"
  | "stable";

export type ResearchEffect = {
  growthMultiplier?: number;
  extractionMultiplier?: number;
  patternMultiplier?: number;
  cloneCostReduction?: number;
  extraGeneSlots?: number;
  offlineCapMultiplier?: number;
  unlockChamberIds?: CoreLayerId[];
  collapseRewardMultiplier?: number;
  instabilityBonus?: number;
};

export type ResearchNode = {
  id: string;
  name: string;
  description: string;
  category: ResearchCategory;
  cost: number;
  prerequisites?: string[];
  effect: ResearchEffect;
  icon: string;
};

export type StrainMastery = {
  harvests: number;
  lifetimeEssence: number;
  highestComplexity: number;
  peakOwned: number;
};

export type MutationEvent = {
  id: string;
  sourceCultureId: string;
  type: "Overgrowth" | "Split Genome" | "Aberrant Bloom" | "Structural Drift" | "Recursive Tumor" | "Containment Leak";
  severity: number;
  essence: number;
  patterns: number;
  message: string;
  createdAt: number;
};

export type GameStateSnapshot = {
  resources: Resources;
  nodes: number;
  totalEssenceEarned: number;
  totalPatternsEarned: number;
  totalRuntimeSeconds: number;
  lifetimeCollapseCount: number;
  totalStableMutationsEarned: number;
  currentRunLifetimeEssence: number;
  currentRunHighestExtractionPerSecond: number;
  currentRunHighestComplexity: number;
  tutorialFlags: Record<string, boolean>;
  unlockedFormulaIds: string[];
  equippedFormulaIds: Array<string | null>;
  fractal: FractalState;
  coreInstances: CoreInstance[];
  coreUpgrades: CoreTypeUpgrade[];
  axiomUpgrades: Record<AxiomUpgradeId, number>;
  researchPurchasedIds: string[];
  strainMastery: Record<string, StrainMastery>;
  discoveredSynergyIds: string[];
  mutationEvents: MutationEvent[];
  highestEssencePerSecond: number;
  selectedLayerId: CoreLayerId;
  unlockedLayerIds: CoreLayerId[];
  lastSavedAt: number;
  saveVersion: number;
  offlineNotice: OfflineGain | null;
  feedback: FeedbackState;
};

export type ProductionBreakdown = {
  essencePerSecond: number;
  patternsPerSecond: number;
  baseEssence: number;
  multiplier: number;
  flatBonus: number;
};

export type OfflineGain = {
  seconds: number;
  essence: number;
};

export type FeedbackState = {
  nodePulse: number;
  harvestPulse: number;
  formulaPulse: number;
  collapsePulse: number;
  lastCollapseReward: number;
  lastGrowthCount: number;
};

export type SaveFile = Omit<GameStateSnapshot, "offlineNotice" | "feedback">;
