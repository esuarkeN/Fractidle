import type { FormulaVisualTag } from "./types";

export type CoreDefinitionId =
  | "root-core"
  | "cell-cluster"
  | "mycelium-strand"
  | "spiral-core"
  | "spiral-bloom"
  | "crystal-core"
  | "echo-core"
  | "fern-core"
  | "lightning-core"
  | "synapse-culture"
  | "recursive-core"
  | "mutation-mass"
  | "boundary-seed";

export type CoreLayerId =
  | "root-grove"
  | "spiralarium"
  | "crystal-lattice"
  | "echo-field"
  | "verdant-plane"
  | "storm-plane"
  | "inner-worlds"
  | "entropy-rift"
  | "infinite-boundary"
  | "all";

export type CoreFractalType = "root" | "cell" | "mycelium" | "spiral" | "crystal" | "echo" | "fern" | "lightning" | "recursive" | "mutation" | "boundary";

export type CoreCycleState = "building" | "harvesting" | "fading";

export type CoreDefinition = {
  id: CoreDefinitionId;
  name: string;
  description: string;
  layerId: Exclude<CoreLayerId, "all">;
  fractalType: CoreFractalType;
  baseCost: number;
  costMultiplier: number;
  baseBuildSpeed: number;
  baseYieldPerNode: number;
  outputTier: number;
  baseComplexity: number;
  unlockRequirement?: {
    essence?: number;
    patterns?: number;
    ownedCores?: number;
    axioms?: number;
    unlockedLayers?: number;
  };
  visualTheme: {
    primary: number;
    secondary: number;
  };
  tags: FormulaVisualTag[];
};

export type CoreInstance = {
  id: string;
  definitionId: CoreDefinitionId;
  instanceIndex: number;
  level: number;
  complexity: number;
  buildSpeedMultiplier: number;
  yieldMultiplier: number;
  cycleProgress: number;
  currentSeed: number;
  currentBuiltBranches: number;
  currentState: CoreCycleState;
  stateProgress: number;
  createdAt: number;
};

export type CoreTypeUpgrade = {
  definitionId: CoreDefinitionId;
  complexityBonus: number;
  yieldLevel: number;
  speedLevel: number;
};

export type CoreLayer = {
  id: Exclude<CoreLayerId, "all">;
  name: string;
  description: string;
  unlockHint: string;
  order: number;
  backgroundTheme: "grove" | "spiral" | "crystal" | "echo" | "verdant" | "storm" | "inner" | "entropy" | "boundary";
  mood: string;
  coreDefinitionIds: CoreDefinitionId[];
};

export type CoreHarvest = {
  instanceId: string;
  definitionId: CoreDefinitionId;
  essence: number;
  patterns: number;
};
