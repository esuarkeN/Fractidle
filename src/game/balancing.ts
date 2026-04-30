export const SAVE_VERSION = 3;
export const STARTING_NODES = 1;
export const FORMULA_SLOTS = 3;
export const BASE_NODE_PRODUCTION = 1.15;
export const NODE_BASE_COST = 10;
export const NODE_COST_GROWTH = 1.145;
export const COLLAPSE_THRESHOLD = 100_000;
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;

export function getNodeCost(nodes: number): number {
  return Math.floor(NODE_BASE_COST * Math.pow(NODE_COST_GROWTH, Math.max(0, nodes - STARTING_NODES)));
}

export function softCap(value: number, cap: number, power = 0.5): number {
  if (value <= cap) return value;
  return cap + Math.pow(value - cap, power);
}

export function getCollapseProgress(essence: number, requirement = COLLAPSE_THRESHOLD): number {
  return Math.min(1, essence / Math.max(1, requirement));
}

export function getAxiomUpgradeCost(currentLevel: number): number {
  return Math.max(1, Math.floor((currentLevel + 1) * Math.pow(1.65, currentLevel)));
}
