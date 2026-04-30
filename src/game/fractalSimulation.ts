import { growFractal } from "./fractalGenerator";
import type { FractalState, GrowthMode } from "./fractalTypes";

export type FractalTickResult = {
  fractal: FractalState;
  grownBranches: number;
};

export function getGrowthThreshold(branchCount: number): number {
  return Math.max(2.2, 4.2 - Math.min(1.8, branchCount * 0.035));
}

export function tickFractalGrowth(
  fractal: FractalState,
  equippedFormulaIds: Array<string | null>,
  deltaSeconds: number,
  essencePerSecond: number,
): FractalTickResult {
  const branchCount = fractal.branches.length;
  const threshold = getGrowthThreshold(branchCount);
  const chargeRate = 1 + Math.min(1.15, essencePerSecond / 18) + Math.min(0.8, branchCount / 80);
  let growthCharge = fractal.growthCharge + deltaSeconds * chargeRate;
  let next = { ...fractal, growthCharge };
  let grownBranches = 0;

  while (next.growthCharge >= threshold && grownBranches < 3 && next.branches.length < 240) {
    next = growFractal(
      { ...next, growthCharge: next.growthCharge - threshold },
      equippedFormulaIds,
      next.growthBias,
      Date.now() + grownBranches * 90,
    );
    grownBranches += 1;
  }

  return { fractal: next, grownBranches };
}

export function guideFractalGrowth(
  fractal: FractalState,
  equippedFormulaIds: Array<string | null>,
  mode: GrowthMode,
): FractalState {
  const grown = growFractal({ ...fractal, growthBias: mode, growthCharge: Math.max(0, fractal.growthCharge * 0.35) }, equippedFormulaIds, mode);
  return { ...grown, growthBias: mode };
}
