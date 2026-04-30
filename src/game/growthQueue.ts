import type { FractalBranch } from "./fractalTypes";

export type GrowthQueueItem = {
  branchId: string;
  queuedAt: number;
};

export function diffGrowthQueue(previous: FractalBranch[], next: FractalBranch[], queuedAt: number): GrowthQueueItem[] {
  const previousIds = new Set(previous.map((branch) => branch.id));
  return next
    .filter((branch) => !previousIds.has(branch.id) && branch.id !== "root")
    .map((branch) => ({ branchId: branch.id, queuedAt }));
}
