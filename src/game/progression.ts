import type { GameStateSnapshot } from "./types";

type RunProgressState = Pick<GameStateSnapshot, "resources" | "currentRunLifetimeEssence" | "totalEssenceEarned" | "totalPatternsEarned">;

export function getEssenceReachedThisRun(state: RunProgressState): number {
  return Math.max(state.resources.essence, state.currentRunLifetimeEssence, state.totalEssenceEarned);
}

export function getPatternsReachedThisRun(state: RunProgressState): number {
  return Math.max(state.resources.patterns, state.totalPatternsEarned);
}
